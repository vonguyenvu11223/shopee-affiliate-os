import test from "node:test";
import assert from "node:assert/strict";
import { calculateProfitBaseline, estimateProductValue } from "../src/lib/intelligence/profit-baseline-engine.ts";

const observations = Array.from({ length: 6 }, (_, index) => ({ experimentId: `e${index}`, productId: `p${index}`, category: "home", views: 2000, clicks: 100, orders: 10, validOrders: 8, validatedCommission: 160000, contentCost: 50000 }));

test("refuses to estimate profit from an insufficient account history", () => {
  const baseline = calculateProfitBaseline(observations.slice(0, 1));
  assert.equal(baseline.status, "INSUFFICIENT");
  assert.equal(estimateProductValue(baseline, 20000), null);
});

test("calculates an account baseline only from internally consistent observations", () => {
  const baseline = calculateProfitBaseline([...observations, { ...observations[0], experimentId: "bad", orders: 101 }]);
  assert.equal(baseline.sampleExperiments, 6);
  assert.equal(baseline.ctr, 0.05);
  assert.equal(baseline.conversionRate, 0.1);
  assert.equal(baseline.validOrderRate, 0.8);
});

test("estimates net profit and break-even with deterministic math", () => {
  const estimate = estimateProductValue(calculateProfitBaseline(observations), 20000);
  assert.ok(estimate);
  assert.equal(estimate.expectedCommission, 160000);
  assert.equal(estimate.expectedNetProfit, 110000);
  assert.equal(estimate.expectedRoi, 2.2);
  assert.equal(estimate.breakEvenViews, 625);
});

test("does not estimate when view attribution is incomplete", () => {
  const incomplete = observations.map((item, index) => index === 0 ? { ...item, views: null } : item);
  assert.equal(estimateProductValue(calculateProfitBaseline(incomplete), 20000), null);
});
