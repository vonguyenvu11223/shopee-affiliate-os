import { z } from "zod";

export const PerformanceRecordInputSchema = z.object({
  experimentId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  views: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  clicks: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  orders: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  validOrders: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  validatedCommission: z.number().finite().min(0).max(1_000_000_000_000),
  pendingCommission: z.number().finite().min(0).max(1_000_000_000_000),
  clickImportRunId: z.string().uuid().nullable().optional(),
  conversionImportRunId: z.string().uuid().nullable().optional(),
}).superRefine((value, context) => {
  const start = Date.parse(`${value.periodStart}T00:00:00Z`);
  const end = Date.parse(`${value.periodEnd}T00:00:00Z`);
  if (start > end) context.addIssue({ code: "custom", path: ["periodEnd"], message: "Ngày kết thúc phải từ ngày bắt đầu trở đi." });
  if (end - start > 366 * 86_400_000) context.addIssue({ code: "custom", path: ["periodEnd"], message: "Khoảng báo cáo không được dài quá 366 ngày." });
  if (value.orders > value.clicks) context.addIssue({ code: "custom", path: ["orders"], message: "Đơn hàng không thể lớn hơn clicks." });
  if (value.validOrders > value.orders) context.addIssue({ code: "custom", path: ["validOrders"], message: "Đơn hợp lệ không thể lớn hơn tổng đơn." });
  if (value.views !== null && value.clicks > value.views) context.addIssue({ code: "custom", path: ["clicks"], message: "Clicks không thể lớn hơn lượt xem." });
});

export type PerformanceRecordInput = z.infer<typeof PerformanceRecordInputSchema>;
