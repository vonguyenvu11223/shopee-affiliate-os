import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublishCaption, PublishMediaKind, PublishPlatform } from "@/lib/publishing/caption-builder";
import type { PublishMode } from "@/lib/publishing/publish-gate";
import type { AffiliateProgramId } from "@/lib/attribution/affiliate-program";

const PUBLISH_ERROR_MESSAGES: Record<string, string> = {
  CONTENT_REVIEW_REQUIRED: "Nội dung chưa qua review gate nên chưa thể đăng.",
  TRACKING_KEY_REQUIRED: "Thiếu mã Sub_id; không đăng khi chưa có attribution.",
  AFFILIATE_URL_REQUIRED: "Thiếu link affiliate; không đăng khi chưa có attribution.",
  SHOWCASE_PRODUCT_REQUIRED: "Chưa gắn sản phẩm TikTok Shop vào video; TikTok sẽ không quy đơn về nội dung này.",
  PROGRAM_PLATFORM_MISMATCH: "Chương trình affiliate này không bán được trên nền tảng đang chọn.",
  UNSUPPORTED_PROGRAM: "Chương trình affiliate chưa được hỗ trợ.",
  CONTENT_ASSET_NOT_FOUND: "Không tìm thấy asset trong tài khoản của bạn.",
  UNSUPPORTED_PLATFORM: "Nền tảng chưa được hỗ trợ.",
  AUTH_REQUIRED: "Bạn cần đăng nhập để thực hiện thao tác này.",
};

function translate(message: string, fallback: string): string {
  const matched = Object.keys(PUBLISH_ERROR_MESSAGES).find(code => message.includes(code));
  return matched ? PUBLISH_ERROR_MESSAGES[matched] : `${fallback}: ${message}`;
}

export interface PublishAttemptRecord {
  assetId: string;
  platform: PublishPlatform;
  program: AffiliateProgramId;
  mode: PublishMode;
  mediaKind: PublishMediaKind;
  externalId: string | null;
  status: "SUBMITTED" | "PROCESSING" | "PUBLISHED" | "FAILED";
  trackingKey: string | null;
  affiliateUrl: string | null;
  showcaseProductId: string | null;
  linkStrategy: PublishCaption["linkStrategy"];
  caption: string | null;
  failureReason: string | null;
}

export async function recordPublishAttempt(input: PublishAttemptRecord): Promise<string> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Database chưa được cấu hình.");
  const { data, error } = await supabase.rpc("record_publish_attempt", {
    p_asset_id: input.assetId,
    p_platform: input.platform,
    p_mode: input.mode,
    p_media_kind: input.mediaKind,
    p_external_id: input.externalId,
    p_status: input.status,
    p_tracking_key: input.trackingKey,
    p_affiliate_url: input.affiliateUrl,
    p_caption: input.caption,
    p_failure_reason: input.failureReason,
    p_affiliate_program: input.program,
    p_showcase_product_id: input.showcaseProductId,
    p_link_strategy: input.linkStrategy,
  });
  if (error) throw new Error(translate(error.message, "Không thể ghi nhận lần đăng"));
  return data as string;
}

export async function listPublishAttempts(limit = 20) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("publish_attempts")
    .select("id, platform, mode, status, external_id, tracking_key, created_at, failure_reason")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return data ?? [];
}
