import test from "node:test";
import assert from "node:assert/strict";
import { buildPublishCaption, captionIncludesAttribution, AI_DISCLOSURE, AFFILIATE_DISCLOSURE, CAPTION_LIMITS } from "../src/lib/publishing/caption-builder.ts";
import { applySubIdsToAffiliateUrl, createTrackingPlan } from "../src/lib/attribution/tracking.ts";

const input = {
  platform: "YOUTUBE",
  program: "SHOPEE",
  productName: "Máy hút bụi cầm tay",
  hook: "Bụi bàn phím biến mất trong 5 giây",
  cta: "Link ở phần mô tả",
  affiliateUrl: "https://s.shopee.vn/abc?sub_id1=youtube",
  trackingKey: "youtube.kenh.mayhutbui.v1.test082026",
  aiGenerated: true,
};

test("YouTube caption carries the affiliate link and tracking key", () => {
  const caption = buildPublishCaption(input);
  assert.equal(caption.linkStrategy, "IN_DESCRIPTION");
  assert.ok(captionIncludesAttribution(caption.description, input.affiliateUrl, input.trackingKey));
});

test("TikTok caption never contains a raw link because it would not be clickable", () => {
  const caption = buildPublishCaption({ ...input, platform: "TIKTOK" });
  assert.equal(caption.linkStrategy, "BIO_REDIRECT");
  assert.ok(!caption.description.includes(input.affiliateUrl));
  assert.ok(caption.description.includes("trang cá nhân"));
});

test("TikTok Shop caption points at the attached showcase", () => {
  const caption = buildPublishCaption({ ...input, platform: "TIKTOK", program: "TIKTOK_SHOP", affiliateUrl: null, trackingKey: null });
  assert.equal(caption.linkStrategy, "NATIVE_SHOWCASE");
  assert.ok(caption.description.includes("gắn sẵn trong video"));
  assert.ok(!caption.description.includes("Mã theo dõi"));
});

test("labels AI generated content and affiliate content", () => {
  const caption = buildPublishCaption(input);
  assert.ok(caption.description.includes(AI_DISCLOSURE));
  assert.ok(caption.description.includes(AFFILIATE_DISCLOSURE));
});

test("omits the AI label for human authored content", () => {
  const caption = buildPublishCaption({ ...input, aiGenerated: false });
  assert.ok(!caption.description.includes(AI_DISCLOSURE));
  assert.ok(caption.description.includes(AFFILIATE_DISCLOSURE));
});

test("uses the hook as the title and falls back to the product name", () => {
  assert.equal(buildPublishCaption(input).title, input.hook);
  assert.equal(buildPublishCaption({ ...input, hook: "   " }).title, input.productName);
});

test("clips an over-long title and reports the truncation", () => {
  const caption = buildPublishCaption({ ...input, hook: "x".repeat(400) });
  assert.equal(caption.title.length, CAPTION_LIMITS.YOUTUBE.title);
  assert.ok(caption.truncated.includes("title"));
});

test("applies the tighter TikTok title limit", () => {
  const caption = buildPublishCaption({ ...input, platform: "TIKTOK", hook: "y".repeat(400) });
  assert.equal(caption.title.length, CAPTION_LIMITS.TIKTOK.title);
});

test("sub ids are attached to the affiliate url", () => {
  const plan = createTrackingPlan({ platform: "tiktok", channel: "Nguyễn Vũ", contentKey: "Máy hút bụi", variant: "v1", campaign: "Test 08/2026" });
  const url = new URL(applySubIdsToAffiliateUrl("https://s.shopee.vn/abc", plan));
  assert.equal(url.searchParams.get("sub_id1"), "tiktok");
  assert.equal(url.searchParams.get("sub_id2"), "nguyenvu");
  assert.equal(url.searchParams.get("sub_id5"), "test082026");
});

test("leaves a malformed affiliate url untouched", () => {
  const plan = createTrackingPlan({ platform: "tiktok", channel: "a", contentKey: "b", variant: "v1", campaign: "c" });
  assert.equal(applySubIdsToAffiliateUrl("khong-phai-url", plan), "khong-phai-url");
});
