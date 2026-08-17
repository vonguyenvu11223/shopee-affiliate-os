import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClickReportResult, ConversionReportResult } from "@/lib/attribution/report-parser";
import { createReportFingerprint } from "@/lib/data/import-fingerprint";

type ReportKind = "click" | "conversion";

export async function persistShopeeReport(input: {
  userId: string;
  kind: ReportKind;
  sourceFilename: string;
  csv: string;
  result: ClickReportResult | ConversionReportResult;
  periodStart: string;
  periodEnd: string;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { mode: "LOCAL_ONLY" as const, duplicate: false, importRunId: null };
  const contentHash = createReportFingerprint(input.kind, input.csv);
  const expectedType = input.kind === "click" ? "CLICK_REPORT" : "CONVERSION_REPORT";
  const { data: existing, error: lookupError } = await supabase.from("import_runs")
    .select("id,status,import_type,parsed_summary").eq("user_id", input.userId).eq("content_hash", contentHash).maybeSingle();
  if (lookupError) throw new Error(`Không thể kiểm tra báo cáo đã nhập: ${lookupError.message}`);
  if (existing) {
    if (existing.import_type !== expectedType) throw new Error("File này đã được nhập trước đó dưới một loại báo cáo khác.");
    if (existing.status !== "COMPLETED") throw new Error(`Lần nhập trước của file đang ở trạng thái ${existing.status}; không được dùng làm lineage.`);
    const summary = existing.parsed_summary as { periodStart?: unknown; periodEnd?: unknown } | null;
    if (summary?.periodStart !== input.periodStart || summary?.periodEnd !== input.periodEnd) throw new Error("File này đã được gắn với một khoảng ngày khác; không được tái sử dụng cho kỳ hiện tại.");
    return { mode: "SUPABASE" as const, duplicate: true, importRunId: existing.id };
  }

  const parsedSummary = input.kind === "click"
    ? { periodStart: input.periodStart, periodEnd: input.periodEnd, clicks: (input.result as ClickReportResult).clicks, mode: (input.result as ClickReportResult).mode, headers: input.result.headers, warnings: input.result.warnings, attributionAvailable: input.result.attributionAvailable, attributionGroups: input.result.attributionGroups }
    : { periodStart: input.periodStart, periodEnd: input.periodEnd, orders: (input.result as ConversionReportResult).orders, validOrders: (input.result as ConversionReportResult).validOrders, canceledOrders: (input.result as ConversionReportResult).canceledOrders, validatedCommission: (input.result as ConversionReportResult).validatedCommission, pendingCommission: (input.result as ConversionReportResult).pendingCommission, headers: input.result.headers, warnings: input.result.warnings, attributionAvailable: input.result.attributionAvailable, attributionGroups: input.result.attributionGroups };
  const { data: run, error: insertError } = await supabase.from("import_runs").insert({
    user_id: input.userId,
    import_type: expectedType,
    source_filename: input.sourceFilename,
    content_hash: contentHash,
    row_count: input.result.rowCount,
    status: "COMPLETED",
    parsed_summary: parsedSummary,
  }).select("id").single();
  if (insertError) throw new Error(`Không thể lưu lineage báo cáo: ${insertError.message}`);
  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: input.userId,
    action: input.kind === "click" ? "CLICK_REPORT_IMPORTED" : "CONVERSION_REPORT_IMPORTED",
    entity_type: "import_run",
    entity_id: run.id,
    metadata: { row_count: input.result.rowCount, content_hash: contentHash, period_start: input.periodStart, period_end: input.periodEnd },
  });
  if (auditError) {
    await supabase.from("import_runs").delete().eq("id", run.id);
    throw new Error(`Không thể ghi audit log báo cáo: ${auditError.message}`);
  }
  return { mode: "SUPABASE" as const, duplicate: false, importRunId: run.id };
}
