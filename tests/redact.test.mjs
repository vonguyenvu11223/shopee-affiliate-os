import test from "node:test";
import assert from "node:assert/strict";
import { redactSensitive } from "../src/lib/observability/redact.ts";

test("redacts credentials recursively without hiding safe tracking keys", () => {
  const result = redactSensitive({ authorization: "Bearer abc", nested: { apiKey: "secret", trackingKey: "tiktok.channel.video.v1.campaign" } });
  assert.deepEqual(result, { authorization: "[REDACTED]", nested: { apiKey: "[REDACTED]", trackingKey: "tiktok.channel.video.v1.campaign" } });
});

test("truncates oversized log strings", () => {
  const result = redactSensitive({ message: "x".repeat(3000) });
  assert.equal(result.message.endsWith("[TRUNCATED]"), true);
});
