import test from "node:test";
import assert from "node:assert/strict";
import { docMocXuatTuTenFile } from "../src/lib/data/export-timestamp.ts";

test("đọc được mốc xuất từ tên file thật của Shopee", () => {
  const ten = "Lấy link sản phẩm hàng loạt20260814095911-243b74f628164878a93b2bb47fc1bcbd.csv";
  const moc = docMocXuatTuTenFile(ten);
  // 09:59:11 giờ Việt Nam = 02:59:11 UTC
  assert.equal(moc, "2026-08-14T02:59:11.000Z");
});

test("trả null khi tên file không có mốc thời gian", () => {
  assert.equal(docMocXuatTuTenFile("export.csv"), null);
  assert.equal(docMocXuatTuTenFile("san-pham-thang-8.csv"), null);
});

test("từ chối ngày không tồn tại thay vì cuộn sang ngày khác", () => {
  // 31/02 — Date.UTC sẽ tự cuộn thành 03/03 nếu không kiểm ngược.
  assert.equal(docMocXuatTuTenFile("export20260231095911-abc.csv"), null);
});

test("từ chối giờ phút giây vô lý", () => {
  assert.equal(docMocXuatTuTenFile("export20260814995911-abc.csv"), null);
  assert.equal(docMocXuatTuTenFile("export20260814096111-abc.csv"), null);
});

test("từ chối mốc ở tương lai xa", () => {
  const namSau = new Date().getUTCFullYear() + 3;
  assert.equal(docMocXuatTuTenFile(`export${namSau}0814095911-abc.csv`), null);
});

test("từ chối mốc quá cũ", () => {
  assert.equal(docMocXuatTuTenFile("export19990814095911-abc.csv"), null);
});

test("bỏ qua chuỗi số không hợp lệ rồi lấy chuỗi hợp lệ tiếp theo", () => {
  // Chuỗi đầu là tháng 99 — phải bỏ qua, không được trả null luôn.
  const moc = docMocXuatTuTenFile("export20269914095911-20260814095911.csv");
  assert.equal(moc, "2026-08-14T02:59:11.000Z");
});
