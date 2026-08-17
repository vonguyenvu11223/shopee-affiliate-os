export type TrendStage =
  | "DISCOVERY"
  | "EARLY_RISING"
  | "BREAKOUT"
  | "TRENDING"
  | "PEAKING"
  | "SATURATED"
  | "DECLINING"
  | "DEAD";

export type Recommendation = "TEST_NOW" | "WATCH" | "SKIP" | "STOP" | "SCALE" | "REVIEW";
export type DataSource = "SHOPEE_API" | "AFFILIATE_API" | "AFFILIATE_EXPORT" | "USER_INPUT" | "DERIVED" | "AI_ESTIMATE";

export interface ProductOpportunity {
  id: string;
  name: string;
  category: string;
  price: number;
  sold: number | null;
  salesVelocity24h?: number | null;
  growth24h: number | null;
  acceleration: number | null;
  commissionRate: number;
  commissionAmount: number;
  trendStage: TrendStage;
  trendScore: number | null;
  profitScore: number | null;
  contentFit: number | null;
  urgencyScore: number | null;
  sellerScore: number | null;
  confidence: number | null;
  dataQualityScore?: number | null;
  expectedProfit: number | null;
  expectedRoi: number | null;
  expectedProfitLow?: number | null;
  expectedProfitHigh?: number | null;
  expectedCommissionPer1kViews?: number | null;
  breakEvenViews?: number | null;
  valueConfidence?: number | null;
  masterScore: number | null;
  recommendation: Recommendation;
  recommendationReason?: string;
  scoringVersion?: string;
  halfLife: string;
  color: string;
  source: DataSource;
  shopName?: string;
  productUrl?: string;
  affiliateUrl?: string;
  importedAt?: string;
}
