import test from "node:test";
import assert from "node:assert/strict";
import { getDecisionLineageStatus } from "../src/lib/intelligence/decision-lineage.ts";

test("allows TESTING to be saved without Shopee report lineage", () => {
  assert.deepEqual(getDecisionLineageStatus("TESTING", { click: null, conversion: null }), {
    required: false, ready: true, missing: [],
  });
});

test("blocks SCALING without both official reports", () => {
  assert.deepEqual(getDecisionLineageStatus("SCALING", { click: "click-run", conversion: null }), {
    required: true, ready: false, missing: ["CONVERSION"],
  });
});

test("allows an evidence-backed terminal decision", () => {
  const result = getDecisionLineageStatus("KILLED", { click: "click-run", conversion: "conversion-run" });
  assert.equal(result.ready, true);
});
