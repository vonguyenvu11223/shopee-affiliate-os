import test from "node:test";
import assert from "node:assert/strict";
import { analyzePerformance } from "../src/lib/intelligence/performance-engine.ts";

test("does not fabricate view metrics when views are unavailable", () => {
  const result = analyzePerformance({ views: null, clicks: 10, orders: 0, validOrders: 0, validatedCommission: 0, pendingCommission: 0, contentCost: 50_000 });
  assert.equal(result.ctr, null);
  assert.equal(result.affiliateRpm, null);
  assert.equal(result.state, "TESTING");
});

test("kills a test after enough clicks without an order", () => {
  const result = analyzePerformance({ views: 10_000, clicks: 120, orders: 0, validOrders: 0, validatedCommission: 0, pendingCommission: 0, contentCost: 100_000 });
  assert.equal(result.state, "KILLED");
  assert.equal(result.netProfit, -100_000);
});

test("scales only on validated commission and valid orders", () => {
  const result = analyzePerformance({ views: 20_000, clicks: 500, orders: 8, validOrders: 6, validatedCommission: 450_000, pendingCommission: 900_000, contentCost: 100_000 });
  assert.equal(result.state, "SCALING");
  assert.equal(result.netProfit, 350_000);
  assert.equal(result.roi, 3.5);
});

test("diagnoses creative when views do not produce clicks", () => {
  const result = analyzePerformance({ views: 10_000, clicks: 50, orders: 2, validOrders: 2, validatedCommission: 20_000, pendingCommission: 0, contentCost: 50_000 });
  assert.equal(result.diagnosis, "CREATIVE");
});
