import type { ContentReviewStatus } from "@/lib/content/video-provenance";
import type { PublishMediaKind, PublishPlatform } from "@/lib/publishing/caption-builder";
import { canSellOn, requiresSubIdTracking, type AffiliateProgramId } from "../attribution/affiliate-program.ts";
import { supportsClickableLink } from "./platform-rules.ts";

export type PublishMode = "DIRECT_PUBLIC" | "DRAFT_INBOX";
export type ConnectionStatus = "CONNECTED" | "EXPIRED" | "REVOKED" | "MISSING";

export type PublishBlocker =
  | "CONTENT_NOT_APPROVED"
  | "NO_MEDIA"
  | "MISSING_AFFILIATE_URL"
  | "MISSING_TRACKING_KEY"
  | "MISSING_SHOWCASE_PRODUCT"
  | "PROGRAM_PLATFORM_MISMATCH"
  | "BIO_LINK_NOT_CONFIGURED"
  | "PLATFORM_NOT_CONNECTED"
  | "CONNECTION_EXPIRED"
  | "MEDIA_KIND_UNSUPPORTED"
  | "PHOTO_REQUIRES_VERIFIED_DOMAIN"
  | "AIGC_LABEL_NOT_ACKNOWLEDGED";

export interface PublishGateInput {
  platform: PublishPlatform;
  program: AffiliateProgramId;
  mediaKind: PublishMediaKind;
  reviewStatus: ContentReviewStatus;
  mediaUrl: string | null;
  affiliateUrl: string | null;
  trackingKey: string | null;
  showcaseProductId: string | null;
  bioLinkConfigured: boolean;
  connectionStatus: ConnectionStatus;
  aigcLabelRequired: boolean;
  aigcLabelAcknowledged: boolean;
  verifiedUrlPrefix: string | null;
}

export interface PublishGateResult {
  publishable: boolean;
  mode: PublishMode;
  blockers: PublishBlocker[];
}

/** YouTube đăng công khai được; TikTok chưa qua audit chỉ đẩy được vào nháp. */
export function resolvePublishMode(platform: PublishPlatform, directPostApproved: boolean): PublishMode {
  if (platform === "YOUTUBE") return "DIRECT_PUBLIC";
  return directPostApproved ? "DIRECT_PUBLIC" : "DRAFT_INBOX";
}

export function evaluatePublishGate(input: PublishGateInput, directPostApproved = false): PublishGateResult {
  const blockers: PublishBlocker[] = [];

  if (input.reviewStatus !== "APPROVED") blockers.push("CONTENT_NOT_APPROVED");
  if (!input.mediaUrl?.trim()) blockers.push("NO_MEDIA");
  if (input.connectionStatus === "MISSING" || input.connectionStatus === "REVOKED") blockers.push("PLATFORM_NOT_CONNECTED");
  if (input.connectionStatus === "EXPIRED") blockers.push("CONNECTION_EXPIRED");
  if (input.aigcLabelRequired && !input.aigcLabelAcknowledged) blockers.push("AIGC_LABEL_NOT_ACKNOWLEDGED");

  if (!canSellOn(input.program, input.platform)) blockers.push("PROGRAM_PLATFORM_MISMATCH");

  if (requiresSubIdTracking(input.program)) {
    if (!input.affiliateUrl?.trim()) blockers.push("MISSING_AFFILIATE_URL");
    if (!input.trackingKey?.trim()) blockers.push("MISSING_TRACKING_KEY");
    // Link chỉ bấm được trong mô tả YouTube; TikTok phải đi qua ô Website trong hồ sơ.
    if (!supportsClickableLink(input.platform) && !input.bioLinkConfigured) blockers.push("BIO_LINK_NOT_CONFIGURED");
  } else if (!input.showcaseProductId?.trim()) {
    blockers.push("MISSING_SHOWCASE_PRODUCT");
  }

  if (input.platform === "YOUTUBE" && input.mediaKind === "PHOTO") blockers.push("MEDIA_KIND_UNSUPPORTED");
  if (input.platform === "TIKTOK" && input.mediaKind === "PHOTO") {
    const prefix = input.verifiedUrlPrefix?.trim();
    if (!prefix || !input.mediaUrl?.startsWith(prefix)) blockers.push("PHOTO_REQUIRES_VERIFIED_DOMAIN");
  }

  return {
    publishable: blockers.length === 0,
    mode: resolvePublishMode(input.platform, directPostApproved),
    blockers,
  };
}

const BLOCKER_MESSAGES: Record<PublishBlocker, string> = {
  CONTENT_NOT_APPROVED: "Nội dung chưa qua review gate.",
  NO_MEDIA: "Chưa có file video/ảnh để đăng.",
  MISSING_AFFILIATE_URL: "Thiếu link affiliate; đăng mà không có link thì không đo được lãi.",
  MISSING_TRACKING_KEY: "Thiếu mã Sub_id nên không thể quy đơn về nội dung này.",
  MISSING_SHOWCASE_PRODUCT: "Chưa chọn sản phẩm TikTok Shop để gắn vào video; không gắn thì TikTok không quy đơn về video này.",
  PROGRAM_PLATFORM_MISMATCH: "Chương trình affiliate này không bán được trên nền tảng đang chọn.",
  BIO_LINK_NOT_CONFIGURED: "TikTok không cho link bấm được trong caption. Đặt link affiliate vào ô Website trong hồ sơ (cần tài khoản Business) rồi xác nhận lại.",
  PLATFORM_NOT_CONNECTED: "Chưa kết nối tài khoản nền tảng.",
  CONNECTION_EXPIRED: "Kết nối đã hết hạn; cần cấp quyền lại.",
  MEDIA_KIND_UNSUPPORTED: "YouTube không nhận bài đăng ảnh.",
  PHOTO_REQUIRES_VERIFIED_DOMAIN: "TikTok chỉ nhận ảnh từ domain đã xác minh; cấu hình TIKTOK_VERIFIED_URL_PREFIX và host ảnh ở đó.",
  AIGC_LABEL_NOT_ACKNOWLEDGED: "Chưa xác nhận gắn nhãn nội dung AI.",
};

export function describePublishBlocker(blocker: PublishBlocker): string {
  return BLOCKER_MESSAGES[blocker];
}
