import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePublishGate, resolvePublishMode, describePublishBlocker } from "../src/lib/publishing/publish-gate.ts";

const youtubeShopee = {
  platform: "YOUTUBE",
  program: "SHOPEE",
  mediaKind: "VIDEO",
  reviewStatus: "APPROVED",
  mediaUrl: "https://example.com/video.mp4",
  affiliateUrl: "https://s.shopee.vn/abc?sub_id1=youtube",
  trackingKey: "youtube.kenh.sanpham.v1.test",
  showcaseProductId: null,
  bioLinkConfigured: false,
  connectionStatus: "CONNECTED",
  aigcLabelRequired: true,
  aigcLabelAcknowledged: true,
  verifiedUrlPrefix: null,
};

const tiktokShop = {
  ...youtubeShopee,
  platform: "TIKTOK",
  program: "TIKTOK_SHOP",
  affiliateUrl: null,
  trackingKey: null,
  showcaseProductId: "1729400000000",
};

test("publishes a Shopee link on YouTube when everything is ready", () => {
  const gate = evaluatePublishGate(youtubeShopee);
  assert.equal(gate.publishable, true);
  assert.equal(gate.mode, "DIRECT_PUBLIC");
});

test("blocks a Shopee link on TikTok until the bio link is configured", () => {
  const blocked = evaluatePublishGate({ ...youtubeShopee, platform: "TIKTOK" });
  assert.equal(blocked.publishable, false);
  assert.ok(blocked.blockers.includes("BIO_LINK_NOT_CONFIGURED"));

  const allowed = evaluatePublishGate({ ...youtubeShopee, platform: "TIKTOK", bioLinkConfigured: true });
  assert.equal(allowed.publishable, true);
  assert.equal(allowed.mode, "DRAFT_INBOX");
});

test("TikTok Shop needs a showcase product instead of a Sub_id link", () => {
  assert.equal(evaluatePublishGate(tiktokShop).publishable, true);

  const missing = evaluatePublishGate({ ...tiktokShop, showcaseProductId: "  " });
  assert.ok(missing.blockers.includes("MISSING_SHOWCASE_PRODUCT"));
  assert.ok(!missing.blockers.includes("MISSING_AFFILIATE_URL"));
});

test("TikTok Shop products cannot be sold from YouTube", () => {
  const gate = evaluatePublishGate({ ...tiktokShop, platform: "YOUTUBE" });
  assert.ok(gate.blockers.includes("PROGRAM_PLATFORM_MISMATCH"));
});

test("refuses to publish content that skipped the review gate", () => {
  const gate = evaluatePublishGate({ ...youtubeShopee, reviewStatus: "AI_DRAFT" });
  assert.ok(gate.blockers.includes("CONTENT_NOT_APPROVED"));
});

test("refuses a Shopee publish without attribution", () => {
  const gate = evaluatePublishGate({ ...youtubeShopee, affiliateUrl: null, trackingKey: "  " });
  assert.ok(gate.blockers.includes("MISSING_AFFILIATE_URL"));
  assert.ok(gate.blockers.includes("MISSING_TRACKING_KEY"));
});

test("reports a missing or expired platform connection", () => {
  assert.ok(evaluatePublishGate({ ...youtubeShopee, connectionStatus: "MISSING" }).blockers.includes("PLATFORM_NOT_CONNECTED"));
  assert.ok(evaluatePublishGate({ ...youtubeShopee, connectionStatus: "EXPIRED" }).blockers.includes("CONNECTION_EXPIRED"));
});

test("TikTok stays in draft mode until direct post is approved", () => {
  assert.equal(resolvePublishMode("TIKTOK", false), "DRAFT_INBOX");
  assert.equal(resolvePublishMode("TIKTOK", true), "DIRECT_PUBLIC");
  assert.equal(resolvePublishMode("YOUTUBE", false), "DIRECT_PUBLIC");
});

test("YouTube rejects photo posts", () => {
  assert.ok(evaluatePublishGate({ ...youtubeShopee, mediaKind: "PHOTO" }).blockers.includes("MEDIA_KIND_UNSUPPORTED"));
});

test("TikTok photos require a verified domain prefix", () => {
  const blocked = evaluatePublishGate({ ...tiktokShop, mediaKind: "PHOTO" });
  assert.ok(blocked.blockers.includes("PHOTO_REQUIRES_VERIFIED_DOMAIN"));

  const allowed = evaluatePublishGate({
    ...tiktokShop, mediaKind: "PHOTO",
    mediaUrl: "https://cdn.mydomain.com/a.jpg", verifiedUrlPrefix: "https://cdn.mydomain.com/",
  });
  assert.equal(allowed.publishable, true);
});

test("blocks publishing when the AI label was never acknowledged", () => {
  assert.ok(evaluatePublishGate({ ...youtubeShopee, aigcLabelAcknowledged: false }).blockers.includes("AIGC_LABEL_NOT_ACKNOWLEDGED"));
});

test("every blocker has a human readable message", () => {
  const gate = evaluatePublishGate({
    ...youtubeShopee, platform: "TIKTOK", reviewStatus: "AI_DRAFT", mediaUrl: null,
    affiliateUrl: null, trackingKey: null, connectionStatus: "MISSING", aigcLabelAcknowledged: false,
  });
  assert.ok(gate.blockers.length >= 5);
  gate.blockers.forEach(blocker => assert.ok(describePublishBlocker(blocker).length > 0));
});
