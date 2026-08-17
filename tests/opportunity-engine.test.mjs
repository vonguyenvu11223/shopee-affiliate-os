import test from "node:test";
import assert from "node:assert/strict";
import { assessTestOpportunity } from "../src/lib/intelligence/opportunity-engine.ts";

const trend = { salesVelocity24h: 20, growth24h: 5, acceleration: 1.5, trendScore: 65, trendStage: "EARLY_RISING", urgencyScore: 50, confidence: 50, dataQualityScore: 55, halfLife: "1–3 ngày" };
const value = { expectedViews: 2000, expectedValidOrders: 3, expectedCommission: 120000, expectedContentCost: 50000, expectedNetProfit: 70000, expectedRoi: 1.4, expectedCommissionPer1kViews: 60000, breakEvenViews: 834, likelyNetProfitLow: 30000, likelyNetProfitHigh: 110000, confidence: 65, baselineStatus: "USABLE" };

test("never recommends a test when the snapshot is stale", () => {
  assert.equal(assessTestOpportunity({ trend, value, freshness: "STALE" }).recommendation, "REVIEW");
});

test("never recommends a test without a real profit baseline", () => {
  assert.equal(assessTestOpportunity({ trend, value: null, freshness: "FRESH" }).recommendation, "REVIEW");
});

test("recommends TEST_NOW only after both trend and value evidence gates", () => {
  const result = assessTestOpportunity({ trend, value, freshness: "FRESH" });
  assert.equal(result.recommendation, "TEST_NOW");
  assert.equal(result.decisionReady, true);
});

test("skips a product with non-positive expected profit", () => {
  const result = assessTestOpportunity({ trend, value: { ...value, expectedNetProfit: -1000, expectedRoi: -0.02 }, freshness: "FRESH" });
  assert.equal(result.recommendation, "SKIP");
});
