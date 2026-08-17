import type { DataFreshnessStatus } from "@/lib/data/freshness";
import type { ProductValueEstimate } from "@/lib/intelligence/profit-baseline-engine";
import type { TrendAnalysis } from "@/lib/intelligence/trend-engine";
import type { Recommendation } from "@/lib/types";

export interface OpportunityAssessment {
  recommendation: Recommendation;
  reason: string;
  profitScore: number | null;
  decisionReady: boolean;
  scoringVersion: "opportunity-v1";
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const OPPORTUNITY_V1_CONFIG = Object.freeze({
  version: "opportunity-v1" as const,
  minimumValueConfidence: 55,
  minimumTrendConfidence: 35,
  roiSignalWeight: 60,
  profitSignalWeight: 40,
  profitSignalTarget: 100_000,
});

export function assessTestOpportunity(input: { trend: TrendAnalysis; value: ProductValueEstimate | null; freshness: DataFreshnessStatus }): OpportunityAssessment {
  const base = { profitScore: null, decisionReady: false, scoringVersion: OPPORTUNITY_V1_CONFIG.version };
  if (input.freshness === "STALE" || input.freshness === "NO_DATA") return { ...base, recommendation: "REVIEW", reason: "Snapshot không đủ mới để ra quyết định." };
  if (!input.value) return { ...base, recommendation: "REVIEW", reason: "Chưa đủ lịch sử performance thật để tính expected value." };
  const roiSignal = input.value.expectedRoi === null ? 0 : clamp((input.value.expectedRoi / 2) * OPPORTUNITY_V1_CONFIG.roiSignalWeight);
  const profitSignal = clamp((input.value.expectedNetProfit / OPPORTUNITY_V1_CONFIG.profitSignalTarget) * OPPORTUNITY_V1_CONFIG.profitSignalWeight);
  const profitScore = Math.round((roiSignal + profitSignal) * input.value.confidence / 100);
  const withProfit = { ...base, profitScore };
  if (input.value.confidence < OPPORTUNITY_V1_CONFIG.minimumValueConfidence) return { ...withProfit, recommendation: "REVIEW", reason: `Baseline profit mới đạt ${input.value.confidence}% confidence.` };
  if (input.value.expectedNetProfit <= 0 || (input.value.expectedRoi ?? -1) <= 0) return { ...withProfit, decisionReady: true, recommendation: "SKIP", reason: "Expected net profit/ROI không dương theo baseline đã xác nhận." };
  if (["DECLINING", "DEAD", "SATURATED"].includes(input.trend.trendStage)) return { ...withProfit, decisionReady: true, recommendation: "SKIP", reason: `Trend đang ở giai đoạn ${input.trend.trendStage}; không mở test mới.` };
  if ((input.trend.confidence ?? 0) < OPPORTUNITY_V1_CONFIG.minimumTrendConfidence || input.trend.trendScore === null) return { ...withProfit, recommendation: "WATCH", reason: "Expected value dương nhưng trend chưa đủ confidence để mở test." };
  if (["EARLY_RISING", "BREAKOUT", "TRENDING"].includes(input.trend.trendStage)) return { ...withProfit, decisionReady: true, recommendation: "TEST_NOW", reason: `Expected value dương và trend ${input.trend.trendStage} đã qua evidence gate.` };
  return { ...withProfit, recommendation: "WATCH", reason: "Theo dõi thêm snapshot trước khi chi ngân sách test." };
}
