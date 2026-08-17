export type ContentProvenance = "USER_AUTHORED" | "AI_ASSISTED" | "AI_GENERATED_UNVERIFIED";
export type ContentReviewStatus = "GENERATING" | "AI_DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "FAILED";
export type ContentGenerator = "TOPVIEW_API" | "TOPVIEW_WEB_MANUAL" | "OTHER_MANUAL";
export type ClaimVerdict = "VERIFIED" | "REMOVED" | "UNVERIFIED";
export type ClaimRisk = "HIGH" | "MEDIUM" | "LOW";

export type ReleaseBlocker =
  | "GENERATION_INCOMPLETE"
  | "GENERATION_FAILED"
  | "NOT_REVIEWED"
  | "REJECTED_BY_REVIEWER"
  | "NO_SCRIPT_TO_REVIEW"
  | "UNRESOLVED_HIGH_RISK_CLAIM"
  | "CLAIM_COUNT_MISMATCH"
  | "AIGC_LABEL_NOT_ACKNOWLEDGED"
  | "REVIEW_NOTE_REQUIRED";

export interface ClaimReviewEntry {
  claim: string;
  risk: ClaimRisk;
  verdict: ClaimVerdict;
}

export interface ContentAssetGateInput {
  provenance: ContentProvenance;
  reviewStatus: ContentReviewStatus;
  generatedScript: string | null;
  detectedClaimCount: number;
  claimReviews: ClaimReviewEntry[];
  aigcLabelAcknowledged: boolean;
  reviewNote: string | null;
}

export interface ContentReleaseGate {
  releasable: boolean;
  blockers: ReleaseBlocker[];
  requiresAigcLabel: boolean;
  requiresClaimReview: boolean;
  unresolvedHighRiskClaims: number;
}

/** Nội dung do AI tự sinh từ URL sản phẩm luôn bị coi là chưa kiểm chứng cho tới khi người thật duyệt. */
export function resolveProvenance(generator: ContentGenerator): ContentProvenance {
  return generator === "OTHER_MANUAL" ? "AI_ASSISTED" : "AI_GENERATED_UNVERIFIED";
}

export function requiresAigcLabel(provenance: ContentProvenance): boolean {
  return provenance !== "USER_AUTHORED";
}

const ALLOWED_TRANSITIONS: Record<ContentReviewStatus, ContentReviewStatus[]> = {
  GENERATING: ["AI_DRAFT", "FAILED"],
  AI_DRAFT: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["REJECTED"],
  REJECTED: ["UNDER_REVIEW"],
  FAILED: [],
};

export function canTransitionReview(from: ContentReviewStatus, to: ContentReviewStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function evaluateContentReleaseGate(input: ContentAssetGateInput): ContentReleaseGate {
  const needsClaimReview = input.provenance === "AI_GENERATED_UNVERIFIED";
  const needsAigcLabel = requiresAigcLabel(input.provenance);
  const unresolvedHighRiskClaims = input.claimReviews.filter(entry => entry.risk === "HIGH" && entry.verdict === "UNVERIFIED").length;
  const blockers: ReleaseBlocker[] = [];

  if (input.reviewStatus === "GENERATING") blockers.push("GENERATION_INCOMPLETE");
  if (input.reviewStatus === "FAILED") blockers.push("GENERATION_FAILED");
  if (input.reviewStatus === "AI_DRAFT" || input.reviewStatus === "UNDER_REVIEW") blockers.push("NOT_REVIEWED");
  if (input.reviewStatus === "REJECTED") blockers.push("REJECTED_BY_REVIEWER");

  if (needsClaimReview) {
    if (!input.generatedScript?.trim()) blockers.push("NO_SCRIPT_TO_REVIEW");
    if (input.claimReviews.length !== input.detectedClaimCount) blockers.push("CLAIM_COUNT_MISMATCH");
    if (unresolvedHighRiskClaims > 0) blockers.push("UNRESOLVED_HIGH_RISK_CLAIM");
    if (!input.reviewNote?.trim()) blockers.push("REVIEW_NOTE_REQUIRED");
  }
  if (needsAigcLabel && !input.aigcLabelAcknowledged) blockers.push("AIGC_LABEL_NOT_ACKNOWLEDGED");

  return {
    releasable: blockers.length === 0 && input.reviewStatus === "APPROVED",
    blockers,
    requiresAigcLabel: needsAigcLabel,
    requiresClaimReview: needsClaimReview,
    unresolvedHighRiskClaims,
  };
}

const BLOCKER_MESSAGES: Record<ReleaseBlocker, string> = {
  GENERATION_INCOMPLETE: "Video đang được tạo; chờ hoàn tất.",
  GENERATION_FAILED: "Tạo video thất bại; không có nội dung để duyệt.",
  NOT_REVIEWED: "Chưa có người duyệt nội dung này.",
  REJECTED_BY_REVIEWER: "Nội dung đã bị từ chối ở bước duyệt.",
  NO_SCRIPT_TO_REVIEW: "Thiếu script do AI sinh; không thể kiểm tra claim.",
  UNRESOLVED_HIGH_RISK_CLAIM: "Còn claim rủi ro cao chưa xác minh hoặc chưa gỡ bỏ.",
  CLAIM_COUNT_MISMATCH: "Số claim đã duyệt không khớp số claim phát hiện được.",
  AIGC_LABEL_NOT_ACKNOWLEDGED: "Chưa xác nhận sẽ gắn nhãn nội dung AI khi đăng.",
  REVIEW_NOTE_REQUIRED: "Người duyệt phải ghi lại kết luận kiểm tra claim.",
};

export function describeBlocker(blocker: ReleaseBlocker): string {
  return BLOCKER_MESSAGES[blocker];
}
