import type { PublishPlatform } from "@/lib/publishing/caption-builder";

/**
 * CLICKABLE_DESCRIPTION: link dán trong mô tả bấm được (YouTube).
 * BIO_ONLY: caption không cho link bấm được; chỉ ô Website trong hồ sơ mới bấm được (TikTok).
 * NATIVE_ONLY: chỉ gắn sản phẩm bằng công cụ của chính nền tảng (Shopee Video).
 */
export type LinkSupport = "CLICKABLE_DESCRIPTION" | "BIO_ONLY" | "NATIVE_ONLY";

export const PLATFORM_LINK_SUPPORT: Record<PublishPlatform, LinkSupport> = {
  YOUTUBE: "CLICKABLE_DESCRIPTION",
  TIKTOK: "BIO_ONLY",
};

export function supportsClickableLink(platform: PublishPlatform): boolean {
  return PLATFORM_LINK_SUPPORT[platform] === "CLICKABLE_DESCRIPTION";
}

export const PLATFORM_LINK_NOTES: Record<LinkSupport, string> = {
  CLICKABLE_DESCRIPTION: "Link trong mô tả bấm được.",
  BIO_ONLY: "TikTok không cho link bấm được trong caption. Chỉ ô Website trong hồ sơ mới bấm được — cần tài khoản Business (miễn phí, không cần 1.000 follower).",
  NATIVE_ONLY: "Chỉ gắn sản phẩm bằng công cụ của nền tảng.",
};
