import type { ProductOpportunity } from "@/lib/types";
import type { DataFreshness } from "@/lib/data/freshness";

export interface AffiliateExportData {
  products: ProductOpportunity[];
  sourceFile: string | null;
  importedAt: string | null;
  isReal: boolean;
  snapshotCount: number;
  productsWithHistory: number;
  recommendationReady: boolean;
  trendReady: boolean;
  freshness: DataFreshness;
}
