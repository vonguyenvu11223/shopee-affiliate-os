import test from "node:test";
import assert from "node:assert/strict";
import { createProductSnapshotFingerprint, createReportFingerprint } from "../src/lib/data/import-fingerprint.ts";

test("treats the same product export as duplicate within one UTC day", () => {
  const first = createProductSnapshotFingerprint("a,b\r\n1,2\r\n", "2026-08-14T01:00:00.000Z");
  const retry = createProductSnapshotFingerprint("\uFEFFa,b\n1,2\n\n", "2026-08-14T23:00:00.000Z");
  assert.equal(first, retry);
});

test("keeps an unchanged product export as a new snapshot on the next day", () => {
  const first = createProductSnapshotFingerprint("a,b\n1,2", "2026-08-14T23:00:00.000Z");
  const nextDay = createProductSnapshotFingerprint("a,b\n1,2", "2026-08-15T01:00:00.000Z");
  assert.notEqual(first, nextDay);
});

test("canonicalizes report line endings but keeps report kinds separate", () => {
  assert.equal(createReportFingerprint("click", "a,b\r\n1,2\r\n"), createReportFingerprint("click", "a,b\n1,2"));
  assert.notEqual(createReportFingerprint("click", "a,b\n1,2"), createReportFingerprint("conversion", "a,b\n1,2"));
});
