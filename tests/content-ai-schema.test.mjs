import test from "node:test";
import assert from "node:assert/strict";
import { ContentAiInputSchema, ContentAiOutputSchema, buildContentAiPrompt } from "../src/lib/ai/content-schema.ts";

test("rejects an AI brief request without real evidence", () => {
  const result = ContentAiInputSchema.safeParse({ productName: "Sản phẩm", audience: "Người thuê trọ", painPoint: "Nhà chật", evidence: "", platform: "tiktok" });
  assert.equal(result.success, false);
});

test("prompt explicitly forbids fabricated claims and deterministic finance", () => {
  const input = ContentAiInputSchema.parse({ productName: "Sản phẩm", audience: "Người thuê trọ", painPoint: "Nhà chật", evidence: "Video quay thực tế", platform: "tiktok" });
  const prompt = buildContentAiPrompt(input);
  assert.match(prompt, /Không bịa công dụng/);
  assert.match(prompt, /Không tính ROI/);
});

test("structured AI output cannot claim high confidence", () => {
  const result = ContentAiOutputSchema.safeParse({ hookOptions: ["a", "b", "c"], problemScene: "p", demoScene: "d", cta: "c", factualBasis: [], claimWarnings: [], confidence: "HIGH" });
  assert.equal(result.success, false);
});
