import { NextResponse } from "next/server";
import { parseClickReportCsv, parseConversionReportCsv } from "@/lib/attribution/report-parser";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistShopeeReport } from "@/repositories/report-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { validateReportPeriod } from "@/lib/attribution/report-period";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "shopee_report.import");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 10, 60_000);
    const userId = await requireUserAuthorization();
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    const period = validateReportPeriod(form.get("periodStart"), form.get("periodEnd"));
    if (!(file instanceof File)) return NextResponse.json({ error: "Chưa chọn file CSV." }, { status: 400 });
    if (kind !== "click" && kind !== "conversion") return NextResponse.json({ error: "Loại báo cáo không hợp lệ." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Chỉ chấp nhận file CSV." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File phải nhỏ hơn 10 MB." }, { status: 400 });
    const csv = await file.text();
    const result = kind === "click" ? parseClickReportCsv(csv) : parseConversionReportCsv(csv);
    const persistence = await persistShopeeReport({ userId, kind, sourceFilename: file.name, csv, result, ...period });
    telemetry.completed({ userId, reportKind: kind, rowCount: result.rowCount, duplicate: persistence.duplicate, importRunId: persistence.importRunId, status: persistence.duplicate ? 200 : 201 });
    return NextResponse.json({ ok: true, kind, result, ...persistence }, { status: persistence.duplicate ? 200 : 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể nhập báo cáo." }, { status });
  }
}
