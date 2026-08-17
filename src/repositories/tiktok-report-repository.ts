import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TikTokShopReportResult } from "@/lib/attribution/tiktok-shop-report";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_REPORTING_PERIOD: "Khoảng ngày báo cáo không hợp lệ.",
  INVALID_CONTENT_HASH: "Không tính được mã kiểm tra của file.",
  INVALID_CONTENT_KEY: "Báo cáo có dòng thiếu mã video.",
  AUTH_REQUIRED: "Bạn cần đăng nhập để thực hiện thao tác này.",
};

function translate(message: string, fallback: string): string {
  const matched = Object.keys(ERROR_MESSAGES).find(code => message.includes(code));
  return matched ? ERROR_MESSAGES[matched] : `${fallback}: ${message}`;
}

/** Chỉ lưu hash + tổng hợp + attribution theo video; không lưu nguyên file báo cáo. */
export async function persistTikTokShopReport(input: {
  sourceFilename: string;
  csv: string;
  result: TikTokShopReportResult;
  periodStart: string;
  periodEnd: string;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { mode: "LOCAL_ONLY" as const, duplicate: false, importRunId: null };

  const contentHash = createHash("sha256").update(input.csv).digest("hex");
  const summary = {
    orders: input.result.orders,
    validOrders: input.result.validOrders,
    validatedCommission: input.result.validatedCommission,
    pendingCommission: input.result.pendingCommission,
    revenue: input.result.revenue,
    rowCount: input.result.rowCount,
    settledColumnFound: input.result.settledColumnFound,
    warnings: input.result.warnings,
  };

  const { data, error } = await supabase.rpc("import_tiktok_shop_report", {
    p_source_filename: input.sourceFilename,
    p_content_hash: contentHash,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_summary: summary,
    p_groups: input.result.attributionGroups,
  });
  if (error) throw new Error(translate(error.message, "Không thể lưu báo cáo TikTok Shop"));

  const payload = data as { importRunId: string; duplicate: boolean; rowCount: number };
  return { mode: "SUPABASE" as const, duplicate: payload.duplicate, importRunId: payload.importRunId };
}
