import { NextResponse } from "next/server";
import { ContentExperimentInputSchema } from "@/lib/content/experiment-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistContentExperiment } from "@/repositories/experiment-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "content_experiment.create");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 12, 60_000);
    const userId = await requireUserAuthorization();
    const parsed = ContentExperimentInputSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: "Brief hoặc tracking chưa đầy đủ/hợp lệ." }, { status: 400 }); }
    const result = await persistContentExperiment(userId, parsed.data);
    telemetry.completed({ userId, experimentId: result.experimentId, status: 201 });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : error instanceof Error && error.message.includes("đã được lưu") ? 409 : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu experiment." }, { status });
  }
}
