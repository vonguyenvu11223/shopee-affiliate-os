import "server-only";

import { ProviderCapabilityError, type PublishPayload, type PublishResult, type PublishingProvider, type ProviderStatus } from "@/providers/contracts";

export class UnavailableShopeePublishingProvider implements PublishingProvider {
  async getStatus(): Promise<ProviderStatus> {
    return { connected: false, capability: "REQUIRES_PERMISSION", lastSyncAt: null, reason: "Shopee Video publishing permission chưa được cấp cho tài khoản/API hiện tại." };
  }
  async canAutoPublish() { return false; }
  async publish(payload: PublishPayload): Promise<PublishResult> {
    void payload;
    throw new ProviderCapabilityError("REQUIRES_PERMISSION", "Auto-publish không khả dụng cho tài khoản hiện tại.", "Đăng nội dung thủ công trên ứng dụng/nền tảng chính thức.");
  }
}
