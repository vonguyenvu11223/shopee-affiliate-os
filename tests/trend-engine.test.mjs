import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProductTrend } from "../src/lib/intelligence/trend-engine.ts";

test("keeps a single real snapshot in DISCOVERY", () => {
  const result = analyzeProductTrend([{ sold: 1000, capturedAt: "2026-08-12T00:00:00.000Z" }]);
  assert.equal(result.trendStage, "DISCOVERY");
  assert.equal(result.growth24h, null);
  assert.equal(result.confidence, null);
});

test("normalizes velocity to a 24 hour window", () => {
  const result = analyzeProductTrend([
    { sold: 1000, capturedAt: "2026-08-12T00:00:00.000Z" },
    { sold: 1100, capturedAt: "2026-08-13T00:00:00.000Z" },
  ]);
  assert.equal(result.salesVelocity24h, 100);
  assert.equal(result.growth24h, 10);
  assert.equal(result.trendStage, "EARLY_RISING");
});

test("detects acceleration from three snapshots", () => {
  const result = analyzeProductTrend([
    { sold: 1000, capturedAt: "2026-08-12T00:00:00.000Z" },
    { sold: 1100, capturedAt: "2026-08-13T00:00:00.000Z" },
    { sold: 1300, capturedAt: "2026-08-14T00:00:00.000Z" },
  ]);
  assert.equal(result.acceleration, 2);
  assert.equal(result.trendStage, "BREAKOUT");
  assert.ok(result.confidence > 0 && result.confidence <= 72);
});

test("rejects decreasing cumulative sales as low-quality data", () => {
  const result = analyzeProductTrend([
    { sold: 1000, capturedAt: "2026-08-12T00:00:00.000Z" },
    { sold: 900, capturedAt: "2026-08-13T00:00:00.000Z" },
  ]);
  assert.equal(result.trendStage, "DISCOVERY");
  assert.equal(result.dataQualityScore, 10);
});
