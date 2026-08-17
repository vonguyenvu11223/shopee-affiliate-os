import "server-only";

import { ProviderCapabilityError, type AffiliateLinkInput, type AffiliateLinkResult, type AffiliateProvider, type ProviderStatus } from "@/providers/contracts";

export class ManualAffiliateProvider implements AffiliateProvider {
  async getStatus(): Promise<ProviderStatus> {
    return { connected: false, capability: "MANUAL_REQUIRED", lastSyncAt: null, reason: "Tài khoản chưa được cấp Affiliate Open API; tạo link trên giao diện Shopee với Sub_id1–5." };
  }

  async generateAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult> {
    void input;
    throw new ProviderCapabilityError("MANUAL_REQUIRED", "Không thể tạo affiliate link qua API cho tài khoản hiện tại.", "Mở https://affiliate.shopee.vn/offer/product_offer và dùng Lấy link.");
  }
}
