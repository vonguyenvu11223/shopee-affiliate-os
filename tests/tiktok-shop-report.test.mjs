import test from "node:test";
import assert from "node:assert/strict";
import { parseTikTokShopReportCsv } from "../src/lib/attribution/tiktok-shop-report.ts";
import { canSellOn, getAffiliateProgram, requiresSubIdTracking } from "../src/lib/attribution/affiliate-program.ts";

test("groups orders and commission by video id", () => {
  const csv = [
    "Video ID,Orders,Settled commission,Est. commission,Revenue",
    "v100,3,45000,60000,900000",
    "v100,2,15000,15000,300000",
    "v200,1,0,20000,200000",
  ].join("\n");
  const result = parseTikTokShopReportCsv(csv);
  assert.equal(result.orders, 6);
  assert.equal(result.attributionGroups.length, 2);
  const first = result.attributionGroups.find(group => group.contentKey === "v100");
  assert.equal(first.orders, 5);
  assert.equal(first.validatedCommission, 60000);
});

test("estimated commission never counts as settled", () => {
  const csv = ["Video ID,Orders,Est. commission", "v1,4,120000"].join("\n");
  const result = parseTikTokShopReportCsv(csv);
  assert.equal(result.settledColumnFound, false);
  assert.equal(result.validatedCommission, 0);
  assert.equal(result.pendingCommission, 120000);
  assert.equal(result.validOrders, 0);
  assert.ok(result.warnings.some(warning => warning.includes("chưa")) || result.warnings.length > 0);
});

test("pending commission is the unsettled remainder", () => {
  const csv = ["Video ID,Orders,Settled commission,Est. commission", "v1,5,40000,100000"].join("\n");
  const result = parseTikTokShopReportCsv(csv);
  assert.equal(result.validatedCommission, 40000);
  assert.equal(result.pendingCommission, 60000);
  assert.equal(result.validOrders, 5);
});

test("warns when the report has no content id to attribute to", () => {
  const csv = ["Date,Orders,Est. commission", "2026-08-01,4,90000"].join("\n");
  const result = parseTikTokShopReportCsv(csv);
  assert.equal(result.attributionAvailable, false);
  assert.ok(result.warnings.some(warning => warning.includes("mã video")));
});

test("rejects a file that is not a TikTok Shop report", () => {
  assert.throws(() => parseTikTokShopReportCsv("Tên sản phẩm,Giá\nMáy hút bụi,199000"), /Không nhận diện được báo cáo TikTok Shop/);
});

test("handles Vietnamese headers and dotted thousands", () => {
  const csv = ["Mã video,Số đơn,Hoa hồng đã thanh toán,Hoa hồng ước tính,Doanh thu", "v9,2,150.000,200.000,1.500.000"].join("\n");
  const result = parseTikTokShopReportCsv(csv);
  assert.equal(result.validatedCommission, 150000);
  assert.equal(result.pendingCommission, 50000);
  assert.equal(result.revenue, 1500000);
});

test("program specs describe how each affiliate program attributes", () => {
  assert.equal(requiresSubIdTracking("SHOPEE"), true);
  assert.equal(requiresSubIdTracking("TIKTOK_SHOP"), false);
  assert.equal(getAffiliateProgram("TIKTOK_SHOP").linkPlacement, "NATIVE_SHOWCASE");
  assert.equal(canSellOn("TIKTOK_SHOP", "YOUTUBE"), false);
  assert.equal(canSellOn("SHOPEE", "YOUTUBE"), true);
});
