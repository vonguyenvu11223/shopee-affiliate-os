export type AffiliateProgramId = "SHOPEE" | "TIKTOK_SHOP";

/**
 * SUB_ID: bạn tự gắn mã theo dõi vào link, báo cáo trả về mã đó (Shopee).
 * NATIVE_CONTENT: nền tảng tự quy đơn về video/showcase, không có mã tự đặt (TikTok Shop).
 */
export type AttributionMode = "SUB_ID" | "NATIVE_CONTENT";
export type LinkPlacement = "DESCRIPTION_LINK" | "NATIVE_SHOWCASE";

export interface AffiliateProgramSpec {
  id: AffiliateProgramId;
  label: string;
  attributionMode: AttributionMode;
  linkPlacement: LinkPlacement;
  /** Nền tảng mà chương trình này thực sự bán được hàng. */
  sellablePlatforms: Array<"YOUTUBE" | "TIKTOK" | "SHOPEE_VIDEO">;
  reportSource: string;
  settlementNote: string;
}

export const AFFILIATE_PROGRAMS: Record<AffiliateProgramId, AffiliateProgramSpec> = {
  SHOPEE: {
    id: "SHOPEE",
    label: "Shopee Affiliate",
    attributionMode: "SUB_ID",
    linkPlacement: "DESCRIPTION_LINK",
    sellablePlatforms: ["YOUTUBE", "TIKTOK", "SHOPEE_VIDEO"],
    reportSource: "Báo cáo click/chuyển đổi từ Shopee Affiliate",
    settlementNote: "Hoa hồng đã đối soát lấy từ đơn hoàn thành trong báo cáo chuyển đổi.",
  },
  TIKTOK_SHOP: {
    id: "TIKTOK_SHOP",
    label: "TikTok Shop Affiliate",
    attributionMode: "NATIVE_CONTENT",
    linkPlacement: "NATIVE_SHOWCASE",
    sellablePlatforms: ["TIKTOK"],
    reportSource: "Báo cáo hiệu suất/thu nhập từ TikTok Shop Creator Center",
    settlementNote: "Hoa hồng ước tính không tính là đã đối soát cho tới khi có cột hoa hồng đã thanh toán.",
  },
};

export function getAffiliateProgram(id: AffiliateProgramId): AffiliateProgramSpec {
  return AFFILIATE_PROGRAMS[id];
}

export function requiresSubIdTracking(id: AffiliateProgramId): boolean {
  return AFFILIATE_PROGRAMS[id].attributionMode === "SUB_ID";
}

export function canSellOn(id: AffiliateProgramId, platform: "YOUTUBE" | "TIKTOK" | "SHOPEE_VIDEO"): boolean {
  return AFFILIATE_PROGRAMS[id].sellablePlatforms.includes(platform);
}
