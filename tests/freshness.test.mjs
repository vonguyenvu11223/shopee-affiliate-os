import test from "node:test";
import assert from "node:assert/strict";
import { getDataFreshness } from "../src/lib/data/freshness.ts";

const now = new Date("2026-08-14T12:00:00.000Z");

test("marks a snapshot under 24 hours as fresh", () => {
  assert.equal(getDataFreshness("2026-08-14T00:00:00.000Z", now).status, "FRESH");
});

test("marks a snapshot between 24 and 72 hours as due", () => {
  assert.equal(getDataFreshness("2026-08-13T00:00:00.000Z", now).status, "DUE");
});

test("marks a snapshot over 72 hours as stale", () => {
  assert.equal(getDataFreshness("2026-08-10T00:00:00.000Z", now).status, "STALE");
});
