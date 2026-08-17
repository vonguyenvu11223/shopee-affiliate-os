import test from "node:test";
import assert from "node:assert/strict";
import { createTrackingPlan, normalizeTrackingToken } from "../src/lib/attribution/tracking.ts";

test("normalizes tracking values to Shopee-safe alphanumeric tokens", () => {
  assert.equal(normalizeTrackingToken("Nguyễn Vũ #01"), "nguyenvu01");
});

test("creates a stable five-part attribution key", () => {
  const plan = createTrackingPlan({ platform: "tiktok", channel: "Nguyễn Vũ", contentKey: "Máy hút bụi 001", variant: "V1", campaign: "Test 08/2026" });
  assert.equal(plan.attributionKey, "tiktok.nguyenvu.mayhutbui001.v1.test082026");
  assert.equal(plan.complete, true);
});

test("marks an incomplete tracking plan", () => {
  const plan = createTrackingPlan({ platform: "youtube", channel: "", contentKey: "video1", variant: "", campaign: "" });
  assert.equal(plan.complete, false);
  assert.equal(plan.subId4, "v1");
});
