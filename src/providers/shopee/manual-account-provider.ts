import "server-only";

import type { ProviderStatus, ShopeeAccountProvider } from "@/providers/contracts";

export class ManualShopeeAccountProvider implements ShopeeAccountProvider {
  async getStatus(): Promise<ProviderStatus> {
    return { connected: true, capability: "MANUAL_REQUIRED", lastSyncAt: null, reason: "Affiliate account hoạt động nhưng AppID/API key chưa được cấp." };
  }
  async getPermissionSummary() {
    return { productExport: "AVAILABLE" as const, reportExport: "AVAILABLE" as const, openApi: "REQUIRES_PERMISSION" as const, productFeed: "UNAVAILABLE" as const, autoPublish: "REQUIRES_PERMISSION" as const, cookieReplay: "UNAVAILABLE" as const };
  }
}
