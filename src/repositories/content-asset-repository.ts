import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { detectClaims, type DetectedClaim } from "@/lib/content/claim-detector";
import { resolveProvenance, type ContentGenerator, type ContentReviewStatus } from "@/lib/content/video-provenance";
import type { ContentReviewDecisionInput, ManualVideoIngestInput } from "@/lib/ai/video-schema";

export interface StoredContentAsset {
  id: string;
  productId: string | null;
  provenance: string;
  generator: ContentGenerator;
  providerTaskId: string | null;
  sourceUrl: string | null;
  videoUrl: string | null;
  generatedScript: string | null;
  detectedClaims: DetectedClaim[];
  claimReviews: Array<{ claim: string; risk: string; verdict: string }>;
  reviewStatus: ContentReviewStatus;
  aigcLabelRequired: boolean;
  aigcLabelAcknowledged: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
  costVnd: number;
  creditCost: number;
  durationSeconds: number | null;
  failureReason: string | null;
  createdAt: string;
}

const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  CONTENT_REVIEW_REQUIRED: "Nội dung chưa được duyệt nên chưa thể dùng cho experiment.",
  UNRESOLVED_HIGH_RISK_CLAIM: "Còn claim rủi ro cao chưa xác minh hoặc chưa gỡ bỏ.",
  CLAIM_COUNT_MISMATCH: "Số claim đã duyệt không khớp số claim phát hiện được.",
  AIGC_LABEL_NOT_ACKNOWLEDGED: "Phải xác nhận sẽ gắn nhãn nội dung AI trước khi duyệt.",
  REVIEW_NOTE_REQUIRED: "Phải ghi lại kết luận kiểm tra claim.",
  NO_SCRIPT_TO_REVIEW: "Thiếu script do AI sinh; không thể kiểm tra claim.",
  CONTENT_NOT_REVIEWABLE: "Asset đang tạo hoặc đã thất bại; chưa thể duyệt.",
  CONTENT_ASSET_NOT_FOUND: "Không tìm thấy asset trong tài khoản của bạn.",
  PRODUCT_NOT_FOUND: "Sản phẩm chưa tồn tại trong Product DB của tài khoản.",
  SCRIPT_REQUIRED_FOR_AI_CONTENT: "Nội dung AI phải kèm script để người duyệt đọc lại.",
  AUTH_REQUIRED: "Bạn cần đăng nhập để thực hiện thao tác này.",
};

function translateDatabaseError(message: string, fallback: string): string {
  const matched = Object.keys(REVIEW_ERROR_MESSAGES).find(code => message.includes(code));
  return matched ? REVIEW_ERROR_MESSAGES[matched] : `${fallback}: ${message}`;
}

async function requireClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Database chưa được cấu hình.");
  return supabase;
}

export function createContentAssetHash(input: { productItemId: string; videoUrl: string | null; script: string | null; taskId: string | null }): string {
  return createHash("sha256")
    .update(JSON.stringify({ p: input.productItemId, v: input.videoUrl ?? "", s: input.script ?? "", t: input.taskId ?? "" }))
    .digest("hex");
}

export async function persistManualVideoAsset(input: ManualVideoIngestInput) {
  const supabase = await requireClient();
  const claims = detectClaims(input.generatedScript);
  const provenance = resolveProvenance(input.generator);
  const contentHash = createContentAssetHash({ productItemId: input.productItemId, videoUrl: input.videoUrl, script: input.generatedScript, taskId: null });
  const { data, error } = await supabase.rpc("save_content_asset", {
    p_product_item_id: input.productItemId,
    p_generator: input.generator,
    p_provenance: provenance,
    p_source_url: input.sourceUrl ?? null,
    p_video_url: input.videoUrl,
    p_generated_script: input.generatedScript,
    p_detected_claims: claims,
    p_duration_seconds: input.durationSeconds ?? null,
    p_credit_cost: 0,
    p_cost_vnd: input.costVnd,
    p_provider_task_id: null,
    p_review_status: "AI_DRAFT",
    p_content_hash: contentHash,
  });
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể lưu video asset"));
  return { assetId: data as string, provenance, detectedClaims: claims };
}

export async function persistPendingTopViewAsset(input: { productItemId: string; productUrl: string; taskId: string }) {
  const supabase = await requireClient();
  const contentHash = createContentAssetHash({ productItemId: input.productItemId, videoUrl: null, script: null, taskId: input.taskId });
  const { data, error } = await supabase.rpc("save_content_asset", {
    p_product_item_id: input.productItemId,
    p_generator: "TOPVIEW_API",
    p_provenance: "AI_GENERATED_UNVERIFIED",
    p_source_url: input.productUrl,
    p_video_url: null,
    p_generated_script: null,
    p_detected_claims: [],
    p_duration_seconds: null,
    p_credit_cost: 0,
    p_cost_vnd: 0,
    p_provider_task_id: input.taskId,
    p_review_status: "GENERATING",
    p_content_hash: contentHash,
  });
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể tạo bản ghi video"));
  return { assetId: data as string };
}

/** Cập nhật asset sau khi poll TopView; claim được phát hiện lại bằng luật deterministic. */
export async function applyTopViewTaskResult(assetId: string, result: {
  state: "PROCESSING" | "SUCCESS" | "FAILED";
  videoUrl: string | null;
  script: string | null;
  durationSeconds: number | null;
  creditCost: number;
  costVnd: number;
  failureReason: string | null;
}) {
  const supabase = await requireClient();
  if (result.state === "PROCESSING") return { reviewStatus: "GENERATING" as ContentReviewStatus, detectedClaims: [] as DetectedClaim[] };
  const claims = result.script ? detectClaims(result.script) : [];
  const reviewStatus: ContentReviewStatus = result.state === "SUCCESS" ? "AI_DRAFT" : "FAILED";
  const { error } = await supabase.from("content_assets").update({
    review_status: reviewStatus,
    video_url: result.videoUrl,
    generated_script: result.script,
    detected_claims: claims,
    duration_seconds: result.durationSeconds,
    credit_cost: result.creditCost,
    cost_vnd: result.costVnd,
    failure_reason: result.failureReason,
  }).eq("id", assetId);
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể cập nhật video asset"));
  return { reviewStatus, detectedClaims: claims };
}

export async function reviewContentAsset(assetId: string, input: ContentReviewDecisionInput) {
  const supabase = await requireClient();
  const { data, error } = await supabase.rpc("review_content_asset", {
    p_asset_id: assetId,
    p_decision: input.decision,
    p_claim_reviews: input.claimReviews,
    p_aigc_label_acknowledged: input.aigcLabelAcknowledged,
    p_review_note: input.reviewNote,
  });
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể lưu kết quả duyệt"));
  return { reviewStatus: data as ContentReviewStatus };
}

export async function attachContentAsset(assetId: string, contentVariantId: string) {
  const supabase = await requireClient();
  const { error } = await supabase.rpc("attach_content_asset", { p_asset_id: assetId, p_content_variant_id: contentVariantId });
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể gắn asset vào content"));
}

function mapAsset(row: Record<string, unknown>): StoredContentAsset {
  return {
    id: String(row.id),
    productId: row.product_id ? String(row.product_id) : null,
    provenance: String(row.provenance),
    generator: row.generator as ContentGenerator,
    providerTaskId: row.provider_task_id ? String(row.provider_task_id) : null,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    videoUrl: row.video_url ? String(row.video_url) : null,
    generatedScript: row.generated_script ? String(row.generated_script) : null,
    detectedClaims: Array.isArray(row.detected_claims) ? row.detected_claims as DetectedClaim[] : [],
    claimReviews: Array.isArray(row.claim_reviews) ? row.claim_reviews as StoredContentAsset["claimReviews"] : [],
    reviewStatus: row.review_status as ContentReviewStatus,
    aigcLabelRequired: Boolean(row.aigc_label_required),
    aigcLabelAcknowledged: Boolean(row.aigc_label_acknowledged),
    reviewNote: row.review_note ? String(row.review_note) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    costVnd: Number(row.cost_vnd ?? 0),
    creditCost: Number(row.credit_cost ?? 0),
    durationSeconds: row.duration_seconds === null || row.duration_seconds === undefined ? null : Number(row.duration_seconds),
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    createdAt: String(row.created_at),
  };
}

export async function getContentAsset(assetId: string): Promise<StoredContentAsset | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from("content_assets").select("*").eq("id", assetId).maybeSingle();
  if (error) throw new Error(translateDatabaseError(error.message, "Không thể đọc video asset"));
  return data ? mapAsset(data) : null;
}

export async function listContentAssets(limit = 50): Promise<StoredContentAsset[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("content_assets").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []).map(mapAsset);
}
