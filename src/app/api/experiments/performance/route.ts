import { NextResponse } from "next/server";
import { PerformanceRecordInputSchema } from "@/lib/intelligence/performance-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistPerformanceRecord } from "@/repositories/performance-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "performance.record");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 20, 60_000);
    const userId = await requireUserAuthorization();
    const parsed = PerformanceRecordInputSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Số liệu không hợp lệ." }, { status: 400 }); }
    const result = await persistPerformanceRecord(userId, parsed.data);
    telemetry.completed({ userId, experimentId: parsed.data.experimentId, decisionId: result.decisionId, status: 201 });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu kết quả hiệu suất." }, { status });
  }
}
