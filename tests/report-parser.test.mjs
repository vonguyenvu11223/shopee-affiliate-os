import test from "node:test";
import assert from "node:assert/strict";
import { parseClickReportCsv, parseConversionReportCsv } from "../src/lib/attribution/report-parser.ts";

test("sums a click report count column", () => {
  const result = parseClickReportCsv("Ngày,Clicks\n2026-08-13,12\n2026-08-14,8\n");
  assert.equal(result.clicks, 20);
  assert.equal(result.mode, "CLICK_COLUMN");
});

test("counts click event rows when the official detail report has timestamps", () => {
  const result = parseClickReportCsv("Thời gian click,Nguồn click\n2026-08-14 10:00,TikTok\n2026-08-14 10:01,YouTube\n");
  assert.equal(result.clicks, 2);
  assert.equal(result.mode, "EVENT_ROWS");
});

test("separates completed, pending and canceled conversion values", () => {
  const csv = "Mã đơn hàng,Trạng thái đơn hàng,Hoa hồng\nA1,Hoàn thành,12000 đ\nA2,Đang xử lý,8000 đ\nA3,Đã hủy,9000 đ\n";
  const result = parseConversionReportCsv(csv);
  assert.deepEqual({ orders: result.orders, valid: result.validOrders, canceled: result.canceledOrders }, { orders: 2, valid: 1, canceled: 1 });
  assert.equal(result.validatedCommission, 12000);
  assert.equal(result.pendingCommission, 8000);
});

test("deduplicates order rows by order id", () => {
  const csv = "Order ID,Order status,Commission\nA1,Completed,5000\nA1,Completed,7000\n";
  const result = parseConversionReportCsv(csv);
  assert.equal(result.orders, 1);
  assert.equal(result.validOrders, 1);
  assert.equal(result.validatedCommission, 12000);
});

test("handles a partially completed multi-line order without counting canceled commission", () => {
  const csv = "Order ID,Order status,Commission\nA1,Completed,5000\nA1,Pending,3000\nA1,Returned,7000\n";
  const result = parseConversionReportCsv(csv);
  assert.equal(result.orders, 1);
  assert.equal(result.validOrders, 1);
  assert.equal(result.canceledOrders, 0);
  assert.equal(result.validatedCommission, 5000);
  assert.equal(result.pendingCommission, 3000);
});

test("refuses an unknown order status instead of treating it as pending", () => {
  const csv = "Order ID,Order status,Commission\nA1,Mystery State,5000\n";
  assert.throws(() => parseConversionReportCsv(csv), /Không nhận diện được trạng thái/);
});

test("recognizes Shopee's documented Vietnamese order states", () => {
  const csv = "Order ID,Order status,Commission\nA1,Đơn hàng chưa thanh toán,0\nA2,Đơn hàng đang xử lý,8000\nA3,Đơn hàng bị hủy,9000\nA4,Đơn hàng hoàn thành,12000\n";
  const result = parseConversionReportCsv(csv);
  assert.deepEqual({ orders: result.orders, valid: result.validOrders, canceled: result.canceledOrders }, { orders: 3, valid: 1, canceled: 1 });
  assert.equal(result.validatedCommission, 12000);
  assert.equal(result.pendingCommission, 8000);
});

test("refuses conflicting attribution for the same order", () => {
  const csv = "Order ID,Order status,Commission,Sub_id1,Sub_id2,Sub_id3,Sub_id4,Sub_id5\nA1,Completed,5000,tiktok,user,video1,v1,camp\nA1,Completed,7000,youtube,user,video2,v1,camp\n";
  assert.throws(() => parseConversionReportCsv(csv), /Sub_id không nhất quán/);
});

test("groups clicks by the complete five-part Sub_id key", () => {
  const csv = "Clicks,Sub_id1,Sub_id2,Sub_id3,Sub_id4,Sub_id5\n12,tiktok,nguyenvu,video001,v1,test082026\n8,youtube,nguyenvu,video002,v1,test082026\n";
  const result = parseClickReportCsv(csv);
  assert.equal(result.attributionAvailable, true);
  assert.equal(result.attributionGroups.find(group => group.trackingKey === "tiktok.nguyenvu.video001.v1.test082026")?.clicks, 12);
});

test("groups conversions by Sub_id and excludes returned orders", () => {
  const csv = "Order ID,Order status,Commission,Sub_id1,Sub_id2,Sub_id3,Sub_id4,Sub_id5\nA1,Completed,12000,tiktok,nguyenvu,video001,v1,test082026\nA2,Returned,9000,tiktok,nguyenvu,video001,v1,test082026\n";
  const result = parseConversionReportCsv(csv);
  const group = result.attributionGroups[0];
  assert.deepEqual({ orders: group.orders, valid: group.validOrders, canceled: group.canceledOrders }, { orders: 1, valid: 1, canceled: 1 });
  assert.equal(group.validatedCommission, 12000);
});

test("marks aggregate reports without complete Sub_ids as unattributed", () => {
  const result = parseClickReportCsv("Clicks,Sub_id1\n5,tiktok\n");
  assert.equal(result.attributionAvailable, false);
  assert.equal(result.attributionGroups.length, 0);
});
