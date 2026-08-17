export interface ClickReportResult {
  clicks: number;
  rowCount: number;
  mode: "CLICK_COLUMN" | "EVENT_ROWS";
  headers: string[];
  warnings: string[];
  attributionAvailable: boolean;
  attributionGroups: ClickAttributionGroup[];
}

export interface ConversionReportResult {
  orders: number;
  validOrders: number;
  validatedCommission: number;
  pendingCommission: number;
  canceledOrders: number;
  rowCount: number;
  headers: string[];
  warnings: string[];
  attributionAvailable: boolean;
  attributionGroups: ConversionAttributionGroup[];
}

export interface ClickAttributionGroup { trackingKey: string; subIds: string[]; clicks: number }
export interface ConversionAttributionGroup { trackingKey: string; subIds: string[]; orders: number; validOrders: number; validatedCommission: number; pendingCommission: number; canceledOrders: number }

type OrderLineStatus = "COMPLETED" | "PENDING" | "CANCELED";

function parseDelimited(input: string): string[][] {
  const firstLine = input.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", "\t", ";"];
  const delimiter = candidates.sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = input.replace(/^\uFEFF/, "");
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

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
const number = (value: string) => {
  const parsed = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};
const findHeader = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalize);
  return headers.findIndex(header => normalizedAliases.includes(normalize(header)));
};

function classifyOrderStatus(raw: string): OrderLineStatus | null {
  const status = normalize(raw);
  if (["huy", "cancel", "reject", "fraud", "khongthanhtoan", "khonghople", "invalid", "hoantra", "trahang", "refund", "return", "hethang", "outofstock"].some(token => status.includes(token))) return "CANCELED";
  if (["hoanthanh", "completed", "approved", "dathanhtoan", "paid", "giaothanhcong", "delivered", "success"].some(token => status.includes(token))) return "COMPLETED";
  if (["dangxuly", "choxuly", "processing", "pending", "choxacnhan", "daxacnhan", "confirmed", "chohoanthanh", "dangcho", "chuathanhtoan", "unpaid", "estimated"].some(token => status.includes(token))) return "PENDING";
  return null;
}

const attributionIndices = (headers: string[]) => Array.from({ length: 5 }, (_, index) => findHeader(headers, [
  `Sub_id${index + 1}`, `Sub_id_${index + 1}`, `Sub id ${index + 1}`, `SubID${index + 1}`,
]));
const attributionForRow = (row: string[], indices: number[]) => {
  if (indices.some(index => index < 0)) return null;
  const subIds = indices.map(index => normalize(row[index] ?? ""));
  return subIds.every(Boolean) ? { subIds, trackingKey: subIds.join(".") } : null;
};

function table(csv: string) {
  const rows = parseDelimited(csv);
  const headers = rows.shift()?.map(value => value.trim()) ?? [];
  if (!headers.length || !rows.length) throw new Error("File CSV không có tiêu đề hoặc không có dòng dữ liệu.");
  return { headers, rows };
}

export function parseClickReportCsv(csv: string): ClickReportResult {
  const { headers, rows } = table(csv);
  const clickIndex = findHeader(headers, ["Clicks", "Click", "Số lượt click", "Lượt click", "Tổng click"]);
  const warnings: string[] = [];
  const subIndices = attributionIndices(headers);
  const grouped = new Map<string, ClickAttributionGroup>();
  rows.forEach(row => {
    const attribution = attributionForRow(row, subIndices);
    if (!attribution) return;
    const clicks = clickIndex >= 0 ? number(row[clickIndex] ?? "") : 1;
    const current = grouped.get(attribution.trackingKey) ?? { ...attribution, clicks: 0 };
    current.clicks += clicks;
    grouped.set(attribution.trackingKey, current);
  });
  const attributionGroups = [...grouped.values()];
  const attributionAvailable = attributionGroups.length > 0;
  if (!attributionAvailable) warnings.push("Báo cáo không có đủ Sub_id1–5; không thể quy click cho từng content.");
  if (clickIndex >= 0) {
    return { clicks: rows.reduce((sum, row) => sum + number(row[clickIndex] ?? ""), 0), rowCount: rows.length, mode: "CLICK_COLUMN", headers, warnings, attributionAvailable, attributionGroups };
  }
  const eventIndex = findHeader(headers, ["Thời gian click", "Click time", "Ngày click", "Nguồn click", "Click source"]);
  if (eventIndex < 0) throw new Error(`Không nhận diện được báo cáo click. Các cột tìm thấy: ${headers.join(", ")}`);
  warnings.push("Không có cột tổng Clicks; hệ thống đếm mỗi dòng chi tiết là một click.");
  return { clicks: rows.length, rowCount: rows.length, mode: "EVENT_ROWS", headers, warnings, attributionAvailable, attributionGroups };
}

export function parseConversionReportCsv(csv: string): ConversionReportResult {
  const { headers, rows } = table(csv);
  const statusIndex = findHeader(headers, ["Trạng thái đơn hàng", "Trạng thái", "Order status", "Conversion status"]);
  const commissionIndex = findHeader(headers, ["Hoa hồng", "Tổng hoa hồng", "Hoa hồng ước tính", "Hoa hồng ròng", "Commission", "Estimated commission"]);
  const orderIdIndex = findHeader(headers, ["Mã đơn hàng", "Mã đơn", "Order ID", "Order id"]);
  if (statusIndex < 0) throw new Error(`Không tìm thấy cột trạng thái đơn hàng. Các cột tìm thấy: ${headers.join(", ")}`);
  const warnings: string[] = [];
  if (commissionIndex < 0) warnings.push("Không nhận diện được cột hoa hồng; các giá trị hoa hồng được giữ ở 0 ₫.");
  if (orderIdIndex < 0) warnings.push("Không có Mã đơn hàng; số đơn được đếm theo số dòng và có thể trùng nếu một đơn có nhiều sản phẩm.");
  const subIndices = attributionIndices(headers);

  const orderGroups = new Map<string, {
    hasCompleted: boolean; hasPending: boolean; hasCanceled: boolean;
    validatedCommission: number; pendingCommission: number;
    attribution: { trackingKey: string; subIds: string[] } | null;
  }>();
  const attributionByOrder = new Map<string, string>();
  const unknownStatuses = new Set<string>();
  rows.forEach((row, rowIndex) => {
    const attribution = attributionForRow(row, subIndices);
    const orderKey = orderIdIndex >= 0 && row[orderIdIndex]?.trim() ? row[orderIdIndex].trim() : `row-${rowIndex}`;
    const trackingKey = attribution?.trackingKey ?? "unattributed";
    const previousTrackingKey = attributionByOrder.get(orderKey);
    if (previousTrackingKey && previousTrackingKey !== trackingKey) throw new Error(`Đơn ${orderKey} có Sub_id không nhất quán giữa các dòng.`);
    attributionByOrder.set(orderKey, trackingKey);
    const status = classifyOrderStatus(row[statusIndex] ?? "");
    if (!status) { unknownStatuses.add(row[statusIndex]?.trim() || "(trống)"); return; }
    const commission = commissionIndex >= 0 ? number(row[commissionIndex] ?? "") : 0;
    const existing = orderGroups.get(orderKey) ?? { hasCompleted: false, hasPending: false, hasCanceled: false, validatedCommission: 0, pendingCommission: 0, attribution };
    if (status === "COMPLETED") { existing.hasCompleted = true; existing.validatedCommission += commission; }
    else if (status === "PENDING") { existing.hasPending = true; existing.pendingCommission += commission; }
    else existing.hasCanceled = true;
    orderGroups.set(orderKey, existing);
  });
  if (unknownStatuses.size) throw new Error(`Không nhận diện được trạng thái đơn hàng: ${[...unknownStatuses].slice(0, 5).join(", ")}. Không cộng số liệu để tránh kết luận sai.`);

  const summaries = new Map<string, ConversionAttributionGroup>();
  let orders = 0;
  let validOrders = 0;
  let canceledOrders = 0;
  let validatedCommission = 0;
  let pendingCommission = 0;
  for (const value of orderGroups.values()) {
    const summary = value.attribution ? (summaries.get(value.attribution.trackingKey) ?? { ...value.attribution, orders: 0, validOrders: 0, canceledOrders: 0, validatedCommission: 0, pendingCommission: 0 }) : null;
    if (!value.hasCompleted && !value.hasPending && value.hasCanceled) { canceledOrders += 1; if (summary) summary.canceledOrders += 1; }
    else if (value.hasCompleted || value.hasPending) {
      orders += 1; if (summary) summary.orders += 1;
      if (value.hasCompleted) { validOrders += 1; if (summary) summary.validOrders += 1; }
      validatedCommission += value.validatedCommission;
      pendingCommission += value.pendingCommission;
      if (summary) { summary.validatedCommission += value.validatedCommission; summary.pendingCommission += value.pendingCommission; }
    }
    if (summary) summaries.set(summary.trackingKey, summary);
  }
  const attributionGroups = [...summaries.values()];
  const attributionAvailable = attributionGroups.length > 0;
  if (!attributionAvailable) warnings.push("Báo cáo không có đủ Sub_id1–5; không thể quy đơn cho từng content.");
  return { orders, validOrders, validatedCommission, pendingCommission, canceledOrders, rowCount: rows.length, headers, warnings, attributionAvailable, attributionGroups };
}
