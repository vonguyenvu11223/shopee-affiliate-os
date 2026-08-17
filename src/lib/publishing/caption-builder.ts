import type { AffiliateProgramId } from "@/lib/attribution/affiliate-program";

export type PublishPlatform = "YOUTUBE" | "TIKTOK";
export type PublishMediaKind = "VIDEO" | "PHOTO";

export interface CaptionInput {
  platform: PublishPlatform;
  program: AffiliateProgramId;
  productName: string;
  hook: string;
  cta: string;
  affiliateUrl: string | null;
  trackingKey: string | null;
  aiGenerated: boolean;
  /** TikTok: đã đặt link ở ô Website trong hồ sơ chưa. */
  bioLinkConfigured?: boolean;
}

export interface PublishCaption {
  title: string;
  description: string;
  truncated: string[];
  linkStrategy: "IN_DESCRIPTION" | "BIO_REDIRECT" | "NATIVE_SHOWCASE";
}

export const CAPTION_LIMITS: Record<PublishPlatform, { title: number; description: number }> = {
  YOUTUBE: { title: 100, description: 5_000 },
  TIKTOK: { title: 90, description: 2_200 },
};

export const AI_DISCLOSURE = "Video có sử dụng nội dung tạo bởi AI.";
export const AFFILIATE_DISCLOSURE = "Bài đăng có chứa link tiếp thị liên kết.";

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();

function clip(value: string, limit: number): { text: string; clipped: boolean } {
  if (value.length <= limit) return { text: value, clipped: false };
  return { text: `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`, clipped: true };
}

/**
 * TikTok không cho link bấm được trong caption, nên dán URL vào đó chỉ tạo ra
 * chữ chết và làm hỏng attribution. Caption TikTok vì vậy dẫn người xem sang
 * giỏ hàng gắn sẵn (TikTok Shop) hoặc sang link trong hồ sơ (Shopee).
 */
export function buildPublishCaption(input: CaptionInput): PublishCaption {
  const limits = CAPTION_LIMITS[input.platform];
  const truncated: string[] = [];

  const rawTitle = collapse(input.hook) || collapse(input.productName);
  const title = clip(rawTitle, limits.title);
  if (title.clipped) truncated.push("title");

  const linkStrategy: PublishCaption["linkStrategy"] =
    input.program === "TIKTOK_SHOP" ? "NATIVE_SHOWCASE"
      : input.platform === "TIKTOK" ? "BIO_REDIRECT"
        : "IN_DESCRIPTION";

  const linkLines =
    linkStrategy === "IN_DESCRIPTION" && input.affiliateUrl ? [`Link sản phẩm: ${input.affiliateUrl}`]
      : linkStrategy === "BIO_REDIRECT" ? ["Link sản phẩm ở phần giới thiệu trang cá nhân."]
        : ["Sản phẩm được gắn sẵn trong video."];

  const trackingLine = input.trackingKey ? [`Mã theo dõi: ${input.trackingKey}`] : [];

  const lines = [
    collapse(input.productName),
    collapse(input.cta),
    "",
    ...linkLines,
    "",
    AFFILIATE_DISCLOSURE,
    ...(input.aiGenerated ? [AI_DISCLOSURE] : []),
    ...trackingLine,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  const description = clip(lines.join("\n"), limits.description);
  if (description.clipped) truncated.push("description");

  return { title: title.text, description: description.text, truncated, linkStrategy };
}

export function captionIncludesAttribution(description: string, affiliateUrl: string, trackingKey: string): boolean {
  return description.includes(affiliateUrl) && description.includes(trackingKey);
}
