import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ManualVideoIngestSchema } from "@/lib/ai/video-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistManualVideoAsset } from "@/repositories/content-asset-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { summarizeClaimRisk } from "@/lib/content/claim-detector";

/** Luồng miễn phí: nạp video đã tạo sẵn trên web TopView vào review gate. */
export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "content_asset.manual_ingest");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 12, 60_000);
    const userId = await requireUserAuthorization();
    const parsed = ManualVideoIngestSchema.safeParse(await request.json());
    if (!parsed.success) {
      telemetry.rejected(400, "INVALID_INPUT");
      return NextResponse.json({ error: "Thiếu link video https, script hoặc sản phẩm hợp lệ." }, { status: 400 });
    }
    const result = await persistManualVideoAsset(parsed.data);
    const risk = summarizeClaimRisk(result.detectedClaims);
    telemetry.completed({ userId, assetId: result.assetId, claimCount: risk.total, highRiskClaims: risk.high, status: 201 });
    revalidatePath("/content");
    return NextResponse.json({ ok: true, assetId: result.assetId, provenance: result.provenance, detectedClaims: result.detectedClaims, risk }, { status: 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu video asset." }, { status });
  }
}
