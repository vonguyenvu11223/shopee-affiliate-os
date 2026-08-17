import test from "node:test";
import assert from "node:assert/strict";
import { validateReportPeriod } from "../src/lib/attribution/report-period.ts";

const now = new Date("2026-08-14T12:00:00.000Z");

test("accepts an inclusive historical report period", () => {
  assert.deepEqual(validateReportPeriod("2026-08-01", "2026-08-14", now), { periodStart: "2026-08-01", periodEnd: "2026-08-14" });
});

test("rejects an impossible calendar date", () => {
  assert.throws(() => validateReportPeriod("2026-02-30", "2026-03-01", now), /không hợp lệ/);
});

test("rejects a future report period", () => {
  assert.throws(() => validateReportPeriod("2026-08-14", "2026-08-15", now), /tương lai/);
});

test("rejects a reversed report period", () => {
  assert.throws(() => validateReportPeriod("2026-08-10", "2026-08-01", now), /sau ngày kết thúc/);
});
