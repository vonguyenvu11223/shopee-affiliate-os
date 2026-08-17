export interface TikTokContentAttributionGroup {
  contentKey: string;
  orders: number;
  validOrders: number;
  validatedCommission: number;
  pendingCommission: number;
  revenue: number;
}

export interface TikTokShopReportResult {
  orders: number;
  validOrders: number;
  validatedCommission: number;
  pendingCommission: number;
  revenue: number;
  rowCount: number;
  headers: string[];
  warnings: string[];
  attributionAvailable: boolean;
  attributionGroups: TikTokContentAttributionGroup[];
  settledColumnFound: boolean;
}

function parseDelimited(input: string): string[][] {
  const source = input.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", "\t", ";"].sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
const amount = (value: string) => {
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};
const count = (value: string) => {
  const parsed = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};
const findHeader = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalize);
  return headers.findIndex(header => normalizedAliases.includes(normalize(header)));
};

/**
 * TikTok Shop không có Sub_id: nền tảng tự quy đơn về video/showcase.
 * Vì vậy khoá attribution là mã video/nội dung do TikTok cấp.
 *
 * Hoa hồng ước tính KHÔNG được tính là đã đối soát. Chỉ cột hoa hồng đã
 * thanh toán/đã đối soát mới vào validatedCommission — nếu báo cáo không có
 * cột đó thì toàn bộ nằm ở pending và validOrders giữ ở 0, để state machine
 * không tuyên bố winner trên tiền chưa về.
 */
export function parseTikTokShopReportCsv(csv: string): TikTokShopReportResult {
  const rows = parseDelimited(csv);
  const headers = rows.shift()?.map(value => value.trim()) ?? [];
  if (!headers.length || !rows.length) throw new Error("File báo cáo không có tiêu đề hoặc không có dòng dữ liệu.");

  const contentIndex = findHeader(headers, ["Video ID", "VideoID", "Content ID", "Mã video", "Video", "Post ID", "Content"]);
  const ordersIndex = findHeader(headers, ["Orders", "Order count", "Items sold", "Số đơn", "Đơn hàng", "Đơn"]);
  const settledIndex = findHeader(headers, ["Settled commission", "Paid commission", "Hoa hồng đã thanh toán", "Hoa hồng đã đối soát", "Commission paid"]);
  const estimatedIndex = findHeader(headers, ["Est. commission", "Estimated commission", "Commission", "Hoa hồng", "Hoa hồng ước tính"]);
  const revenueIndex = findHeader(headers, ["Revenue", "GMV", "Video GMV", "Showcase GMV", "Doanh thu"]);
  const validOrdersIndex = findHeader(headers, ["Valid orders", "Settled orders", "Đơn hợp lệ", "Đơn đã đối soát"]);

  if (ordersIndex < 0 && estimatedIndex < 0 && settledIndex < 0) {
    throw new Error(`Không nhận diện được báo cáo TikTok Shop. Các cột tìm thấy: ${headers.join(", ")}`);
  }

  const warnings: string[] = [];
  const settledColumnFound = settledIndex >= 0;
  if (!settledColumnFound) {
    warnings.push("Báo cáo không có cột hoa hồng đã đối soát; toàn bộ hoa hồng được ghi là ước tính và số đơn hợp lệ giữ ở 0.");
  }
  if (contentIndex < 0) {
    warnings.push("Báo cáo không có mã video/nội dung; không thể quy đơn về từng video.");
  }
  if (revenueIndex < 0) warnings.push("Không nhận diện được cột doanh thu/GMV; giá trị được giữ ở 0.");

  const grouped = new Map<string, TikTokContentAttributionGroup>();
  let orders = 0;
  let validOrders = 0;
  let validatedCommission = 0;
  let pendingCommission = 0;
  let revenue = 0;

  rows.forEach(row => {
    const rowOrders = ordersIndex >= 0 ? count(row[ordersIndex] ?? "") : 0;
    const settled = settledColumnFound ? amount(row[settledIndex] ?? "") : 0;
    const estimated = estimatedIndex >= 0 ? amount(row[estimatedIndex] ?? "") : 0;
    const rowRevenue = revenueIndex >= 0 ? amount(row[revenueIndex] ?? "") : 0;
    const rowValidOrders = validOrdersIndex >= 0 ? count(row[validOrdersIndex] ?? "")
      : settledColumnFound && settled > 0 ? rowOrders : 0;
    const rowPending = settledColumnFound ? Math.max(0, estimated - settled) : estimated;

    orders += rowOrders;
    validOrders += rowValidOrders;
    validatedCommission += settled;
    pendingCommission += rowPending;
    revenue += rowRevenue;

    if (contentIndex < 0) return;
    const contentKey = (row[contentIndex] ?? "").trim();
    if (!contentKey) return;
    const current = grouped.get(contentKey) ?? { contentKey, orders: 0, validOrders: 0, validatedCommission: 0, pendingCommission: 0, revenue: 0 };
    current.orders += rowOrders;
    current.validOrders += rowValidOrders;
    current.validatedCommission += settled;
    current.pendingCommission += rowPending;
    current.revenue += rowRevenue;
    grouped.set(contentKey, current);
  });

  const attributionGroups = [...grouped.values()];
  return {
    orders, validOrders,
    validatedCommission: Number(validatedCommission.toFixed(2)),
    pendingCommission: Number(pendingCommission.toFixed(2)),
    revenue: Number(revenue.toFixed(2)),
    rowCount: rows.length,
    headers,
    warnings,
    attributionAvailable: attributionGroups.length > 0,
    attributionGroups,
    settledColumnFound,
  };
}
