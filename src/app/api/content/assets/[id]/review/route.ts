import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ContentReviewDecisionSchema } from "@/lib/ai/video-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { reviewContentAsset } from "@/repositories/content-asset-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const telemetry = createRequestTelemetry(request, "content_asset.review");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 30, 60_000);
    const userId = await requireUserAuthorization();
    const { id } = await params;
    if (!UUID.test(id)) { telemetry.rejected(400, "INVALID_ASSET_ID"); return NextResponse.json({ error: "Asset không hợp lệ." }, { status: 400 }); }
    const parsed = ContentReviewDecisionSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: "Dữ liệu duyệt không hợp lệ." }, { status: 400 }); }

    const result = await reviewContentAsset(id, parsed.data);
    telemetry.completed({ userId, assetId: id, decision: parsed.data.decision, reviewStatus: result.reviewStatus, status: 200 });
    revalidatePath("/content");
    return NextResponse.json({ ok: true, reviewStatus: result.reviewStatus });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 422;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể lưu kết quả duyệt." }, { status });
  }
}
