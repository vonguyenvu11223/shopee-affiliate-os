import "server-only";

import { getAffiliateExportData } from "@/lib/data/affiliate-export";
import type { ProductProvider, ProductSearchInput, ProductSearchResult, ProviderStatus } from "@/providers/contracts";

export class OfficialCsvProductProvider implements ProductProvider {
  async getStatus(): Promise<ProviderStatus> {
    const data = await getAffiliateExportData();
    return { connected: data.isReal, capability: data.isReal ? "AVAILABLE" : "MANUAL_REQUIRED", lastSyncAt: data.importedAt, reason: data.isReal ? null : "Cần nhập file Lấy link sản phẩm hàng loạt từ Shopee Affiliate." };
  }

  async searchProducts(input: ProductSearchInput): Promise<ProductSearchResult> {
    const data = await getAffiliateExportData();
    const query = input.query?.trim().toLocaleLowerCase("vi") ?? "";
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));
    const offset = Math.max(0, Number(input.cursor) || 0);
    const filtered = query ? data.products.filter(product => product.name.toLocaleLowerCase("vi").includes(query)) : data.products;
    const products = filtered.slice(offset, offset + limit);
    return { products, nextCursor: offset + products.length < filtered.length ? String(offset + products.length) : null, source: "AFFILIATE_EXPORT" };
  }

  async getProduct(id: string) {
    const data = await getAffiliateExportData();
    return data.products.find(product => product.id === id) ?? null;
  }
}
