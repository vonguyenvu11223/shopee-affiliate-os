import type { ProductOpportunity, Recommendation, TrendStage } from "@/lib/types";

export const SCORING_VERSION = "profit-v1.0.0";

export interface ScoreInput {
  trend: number;
  expectedProfit: number;
  contentFit: number;
  conversionPotential: number;
  commissionQuality: number;
  seller: number;
  opportunityGap: number;
  urgency: number;
  confidence: number;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function calculateMasterScore(input: ScoreInput): number {
  return Math.round(clamp(
    input.expectedProfit * 0.22 + input.trend * 0.18 + input.contentFit * 0.15 +
    input.conversionPotential * 0.12 + input.commissionQuality * 0.1 + input.seller * 0.08 +
    input.opportunityGap * 0.07 + input.urgency * 0.05 + input.confidence * 0.03,
  ));
}

export function classifyTrend(growth24h: number, acceleration: number, score: number): TrendStage {
  if (growth24h < -20) return "DECLINING";
  if (score >= 88 && acceleration >= 2) return "BREAKOUT";
  if (growth24h >= 35 && acceleration >= 1.2) return "EARLY_RISING";
  if (score >= 70) return "TRENDING";
  return "DISCOVERY";
}

export function decide(opportunity: { masterScore: number; expectedRoi: number; confidence: number; trendStage: ProductOpportunity["trendStage"] }): Recommendation {
  if (opportunity.trendStage === "DECLINING") return "STOP";
  if (opportunity.masterScore >= 85 && opportunity.expectedRoi >= 2 && opportunity.confidence >= 70) return "TEST_NOW";
  if (opportunity.masterScore >= 70) return "WATCH";
  return "SKIP";
}

export function expectedProfit(params: {
  expectedViews: number;
  ctr: number;
  conversionRate: number;
  validOrderRate: number;
  commissionPerOrder: number;
  contentCost: number;
}) {
  const orders = params.expectedViews * params.ctr * params.conversionRate * params.validOrderRate;
  const commission = orders * params.commissionPerOrder;
  const netProfit = commission - params.contentCost;
  return {
    orders,
    commission,
    netProfit,
    roi: params.contentCost > 0 ? netProfit / params.contentCost : 0,
    breakEvenViews: commission > 0 ? Math.ceil((params.contentCost / commission) * params.expectedViews) : 0,
  };
}
