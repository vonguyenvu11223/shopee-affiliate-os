import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAttributedPerformance } from "../src/lib/intelligence/performance-summary.ts";
import { analyzePerformance } from "../src/lib/intelligence/performance-engine.ts";

const verifiedPeriod = {
  views: 10_000,
  clicks: 300,
  orders: 20,
  validOrders: 10,
  pendingCommission: 0,
  validatedCommission: 600_000,
  reportRoles: ["CLICK", "CONVERSION"],
};

test("does not produce analytics when any period lacks official lineage", () => {
  const result = summarizeAttributedPerformance([
    verifiedPeriod,
    { ...verifiedPeriod, reportRoles: ["CLICK"] },
  ], 100_000);
  assert.equal(result.lineageComplete, false);
  assert.equal(result.totals, null);
});

test("aggregates verified periods and charges content cost once", () => {
  const result = summarizeAttributedPerformance([verifiedPeriod, verifiedPeriod], 200_000);
  assert.equal(result.lineageComplete, true);
  assert.equal(result.totals?.validatedCommission, 1_200_000);
  const analysis = analyzePerformance(result.totals);
  assert.equal(analysis.netProfit, 1_000_000);
  assert.equal(analysis.state, "SCALING");
});

test("keeps view-derived metrics unavailable when one period has no views", () => {
  const result = summarizeAttributedPerformance([verifiedPeriod, { ...verifiedPeriod, views: null }], 200_000);
  assert.equal(result.totals?.views, null);
  const analysis = analyzePerformance(result.totals);
  assert.equal(analysis.ctr, null);
  assert.equal(analysis.affiliateRpm, null);
});
