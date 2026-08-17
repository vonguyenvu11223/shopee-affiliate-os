import test from "node:test";
import assert from "node:assert/strict";
import { buildVisualPrompt, suggestSubjectEn } from "../src/lib/content/visual-prompt.ts";

const base = {
  target: "UGC_VIDEO",
  subjectEn: "handheld car vacuum cleaner",
  audienceEn: "young car owners in Vietnam",
  settingEn: "car interior, daytime",
  useCaseEn: "vacuuming crumbs from seat gaps",
  tone: "energetic",
  aspectRatio: "9:16",
  durationSeconds: 15,
};

test("builds a ready prompt when every field is filled", () => {
  const result = buildVisualPrompt(base);
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
  assert.ok(result.prompt.includes("handheld car vacuum cleaner"));
  assert.ok(result.prompt.includes("9:16"));
});

test("reports missing fields instead of inventing them", () => {
  const result = buildVisualPrompt({ ...base, audienceEn: "  ", useCaseEn: "" });
  assert.equal(result.ready, false);
  assert.equal(result.missing.length, 2);
});

test("UGC prompt includes a presenter, cinematic prompt does not", () => {
  assert.ok(buildVisualPrompt(base).prompt.includes("Presenter:"));
  const cinematic = buildVisualPrompt({ ...base, target: "CINEMATIC_VIDEO" });
  assert.ok(cinematic.prompt.includes("No presenter"));
  assert.ok(cinematic.prompt.includes("Cinematic product film"));
});

test("shot ranges cover the requested duration", () => {
  const result = buildVisualPrompt({ ...base, durationSeconds: 30 });
  assert.equal(result.shots.length, 4);
  assert.equal(result.shots[0].range.startsWith("0-"), true);
  assert.equal(result.shots.at(-1).range.endsWith("30s"), true);
});

test("blocks efficacy claims from leaking into the prompt", () => {
  const result = buildVisualPrompt({ ...base, useCaseEn: "removing 99% of dust, guaranteed best on the market" });
  assert.equal(result.ready, false);
  assert.ok(result.warnings.length > 0);
});

test("negative prompt forbids on-screen text and claims", () => {
  const result = buildVisualPrompt(base);
  assert.ok(result.negativePrompt.includes("on-screen text"));
  assert.ok(result.negativePrompt.includes("medical or health claim on screen"));
  assert.ok(result.prompt.includes("No text, captions or claims rendered in frame."));
});

test("suggests an English subject from a Vietnamese product name", () => {
  assert.equal(suggestSubjectEn("Máy hút bụi cầm tay mini"), "handheld vacuum cleaner");
  assert.equal(suggestSubjectEn("Tai nghe bluetooth"), "wireless earbuds");
  assert.equal(suggestSubjectEn("Sản phẩm không rõ loại"), "");
});
