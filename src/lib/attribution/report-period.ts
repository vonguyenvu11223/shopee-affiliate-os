export interface ReportPeriod {
  periodStart: string;
  periodEnd: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateReportPeriod(periodStart: unknown, periodEnd: unknown, today = new Date()): ReportPeriod {
  if (typeof periodStart !== "string" || typeof periodEnd !== "string" || !ISO_DATE.test(periodStart) || !ISO_DATE.test(periodEnd)) {
    throw new Error("Khoảng ngày báo cáo phải có định dạng YYYY-MM-DD.");
  }
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString().slice(0, 10) !== periodStart || new Date(end).toISOString().slice(0, 10) !== periodEnd) {
    throw new Error("Khoảng ngày báo cáo không hợp lệ.");
  }
  if (start > end) throw new Error("Ngày bắt đầu báo cáo không được sau ngày kết thúc.");
  if ((end - start) / 86_400_000 > 366) throw new Error("Khoảng báo cáo không được dài quá 366 ngày.");
  const todayUtc = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (end > todayUtc) throw new Error("Ngày kết thúc báo cáo không được nằm trong tương lai.");
  return { periodStart, periodEnd };
}
