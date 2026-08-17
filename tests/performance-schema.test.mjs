import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceRecordInputSchema } from "../src/lib/intelligence/performance-schema.ts";

const valid = { experimentId: "32d9d999-bf40-4fc9-9c69-0a427c2fdcef", periodStart: "2026-08-01", periodEnd: "2026-08-14", views: 1000, clicks: 50, orders: 3, validOrders: 2, validatedCommission: 100000, pendingCommission: 20000 };

test("accepts internally consistent real performance metrics", () => {
  assert.equal(PerformanceRecordInputSchema.safeParse(valid).success, true);
});

test("rejects more orders than clicks", () => {
  assert.equal(PerformanceRecordInputSchema.safeParse({ ...valid, orders: 51 }).success, false);
});

test("rejects more valid orders than total orders", () => {
  assert.equal(PerformanceRecordInputSchema.safeParse({ ...valid, validOrders: 4 }).success, false);
});

test("rejects an untraceable report import id", () => {
  assert.equal(PerformanceRecordInputSchema.safeParse({ ...valid, clickImportRunId: "not-a-uuid" }).success, false);
});

test("rejects a reversed reporting period", () => {
  assert.equal(PerformanceRecordInputSchema.safeParse({ ...valid, periodStart: "2026-08-15" }).success, false);
});
