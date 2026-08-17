import test from "node:test";
import assert from "node:assert/strict";
import { detectClaims, splitScriptSentences, summarizeClaimRisk } from "../src/lib/content/claim-detector.ts";

test("flags medical and guarantee claims as high risk", () => {
  const claims = detectClaims("Sản phẩm này chữa dứt điểm mụn. Chúng tôi cam kết hoàn tiền 100% nếu không hiệu quả.");
  assert.equal(claims.length, 2);
  assert.ok(claims.every(claim => claim.risk === "HIGH"));
});

test("flags fabricated personal experience", () => {
  const claims = detectClaims("Mình đã dùng sản phẩm này được một tháng và rất hài lòng.");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].risk, "HIGH");
  assert.ok(claims[0].reasons.some(reason => reason.includes("Trải nghiệm cá nhân")));
});

test("flags measured results and superlatives", () => {
  const claims = detectClaims("Giảm đến 50% điện năng. Đây là loại tốt nhất thị trường.");
  assert.equal(claims.length, 2);
  assert.ok(claims.every(claim => claim.risk === "HIGH"));
});

test("treats promotion and certification as medium risk", () => {
  const claims = detectClaims("Đang có voucher giảm giá cho đơn đầu tiên.");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].risk, "MEDIUM");
});

test("ignores neutral descriptive sentences", () => {
  assert.deepEqual(detectClaims("Máy có ba mức công suất. Dây dài một mét rưỡi."), []);
});

test("does not double count a repeated sentence", () => {
  const claims = detectClaims("Cam kết chính hãng. Cam kết chính hãng.");
  assert.equal(claims.length, 1);
});

test("splits bullet and sentence separated scripts", () => {
  const sentences = splitScriptSentences("- Hook mở đầu\n- Cảnh demo sản phẩm\nCTA cuối cùng.");
  assert.equal(sentences.length, 3);
});

test("flags high risk claims written in English", () => {
  const claims = detectClaims("This cures acne overnight. Guaranteed best on the market. Removes 99% of dust.");
  assert.equal(claims.length, 3);
  assert.ok(claims.every(claim => claim.risk === "HIGH"));
});

test("flags fabricated personal experience in English", () => {
  const claims = detectClaims("I have used this for a month and it changed my routine.");
  assert.equal(claims[0].risk, "HIGH");
  assert.ok(claims[0].reasons.some(reason => reason.includes("Trải nghiệm cá nhân")));
});

test("ignores neutral English product description", () => {
  assert.deepEqual(detectClaims("The device has three power levels. The cable is one and a half meters long."), []);
});

test("summarizes risk counts", () => {
  const summary = summarizeClaimRisk(detectClaims("Tốt nhất thị trường. Đang có freeship toàn quốc."));
  assert.deepEqual(summary, { total: 2, high: 1, medium: 1 });
});
