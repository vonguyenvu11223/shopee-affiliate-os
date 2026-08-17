import type { ProductOpportunity } from "@/lib/types";

export type ProviderCapability = "AVAILABLE" | "UNAVAILABLE" | "REQUIRES_PERMISSION" | "MANUAL_REQUIRED";

export interface ProviderStatus {
  connected: boolean;
  capability: ProviderCapability;
  lastSyncAt: string | null;
  reason: string | null;
}

export interface ProductSearchInput {
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface ProductSearchResult {
  products: ProductOpportunity[];
  nextCursor: string | null;
  source: "SHOPEE_API" | "AFFILIATE_EXPORT";
}

export interface ProductProvider {
  getStatus(): Promise<ProviderStatus>;
  searchProducts(input: ProductSearchInput): Promise<ProductSearchResult>;
  getProduct(id: string): Promise<ProductOpportunity | null>;
}

export interface AffiliateLinkInput {
  productUrl: string;
  subIds: [string?, string?, string?, string?, string?];
}

export interface AffiliateLinkResult {
  affiliateUrl: string;
  source: "AFFILIATE_API" | "AFFILIATE_EXPORT" | "USER_INPUT";
  createdAt: string;
}

export interface AffiliateProvider {
  getStatus(): Promise<ProviderStatus>;
  generateAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult>;
}

export interface AnalyticsSyncInput { from: string; to: string }
export interface AnalyticsSyncResult { clicks: number; orders: number; validOrders: number; validatedCommission: number; sourceFile?: string }

export interface AnalyticsProvider {
  getStatus(): Promise<ProviderStatus>;
  syncPerformance(input: AnalyticsSyncInput): Promise<AnalyticsSyncResult>;
}

export interface PublishingProvider {
  getStatus(): Promise<ProviderStatus>;
  canAutoPublish(): Promise<boolean>;
  publish(payload: PublishPayload): Promise<PublishResult>;
}

export interface PublishPayload { platform: "SHOPEE_VIDEO" | "TIKTOK" | "YOUTUBE"; contentId: string; assetUrl: string; caption: string }
export interface PublishResult { externalId: string; publishedAt: string; source: string }

export interface ShopeeAccountProvider {
  getStatus(): Promise<ProviderStatus>;
  getPermissionSummary(): Promise<Record<string, ProviderCapability>>;
}

export class ProviderCapabilityError extends Error {
  constructor(public readonly capability: ProviderCapability, message: string, public readonly manualAction?: string) {
    super(message);
    this.name = "ProviderCapabilityError";
  }
}
