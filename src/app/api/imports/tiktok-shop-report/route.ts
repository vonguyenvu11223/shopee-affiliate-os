import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseTikTokShopReportCsv } from "@/lib/attribution/tiktok-shop-report";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistTikTokShopReport } from "@/repositories/tiktok-report-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { validateReportPeriod } from "@/lib/attribution/report-period";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "tiktok_shop_report.import");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 10, 60_000);
    const userId = await requireUserAuthorization();
    const form = await request.formData();
    const file = form.get("file");
    const period = validateReportPeriod(form.get("periodStart"), form.get("periodEnd"));
    if (!(file instanceof File)) return NextResponse.json({ error: "Chưa chọn file báo cáo." }, { status: 400 });
    if (!/\.(csv|tsv)$/i.test(file.name)) return NextResponse.json({ error: "Xuất báo cáo dạng CSV trước khi nhập." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File phải nhỏ hơn 10 MB." }, { status: 400 });

    const csv = await file.text();
    const result = parseTikTokShopReportCsv(csv);
    const persistence = await persistTikTokShopReport({ sourceFilename: file.name, csv, result, ...period });

    telemetry.completed({ userId, rowCount: result.rowCount, contentGroups: result.attributionGroups.length, settled: result.settledColumnFound, duplicate: persistence.duplicate, importRunId: persistence.importRunId, status: persistence.duplicate ? 200 : 201 });
    revalidatePath("/settings/shopee");
    return NextResponse.json({ ok: true, result, ...persistence }, { status: persistence.duplicate ? 200 : 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể nhập báo cáo TikTok Shop." }, { status });
  }
}
