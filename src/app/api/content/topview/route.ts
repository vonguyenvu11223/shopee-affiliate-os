import { NextResponse } from "next/server";
import { TopViewGenerateSchema } from "@/lib/ai/video-schema";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { getTopViewCapability, submitUrlToVideo } from "@/providers/ai/topview-video";
import { persistPendingTopViewAsset } from "@/repositories/content-asset-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { ProviderCapabilityError } from "@/providers/contracts";

/**
 * Luồng API TopView. Request này ngắn: gửi job, nhận taskId, trả ngay.
 * Việc chờ video chạy ở phía TopView, client poll qua GET /api/content/topview/[id].
 */
export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "topview.generate");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 6, 60_000);
    const userId = await requireUserAuthorization();
    const capability = getTopViewCapability();
    if (capability.capability !== "AVAILABLE") {
      telemetry.rejected(503, "TOPVIEW_API_UNAVAILABLE");
      return NextResponse.json({ error: capability.reason, capability: capability.capability }, { status: 503 });
    }
    const parsed = TopViewGenerateSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: "Thiếu link sản phẩm https hợp lệ." }, { status: 400 }); }

    const taskId = await submitUrlToVideo(parsed.data);
    const { assetId } = await persistPendingTopViewAsset({ productItemId: parsed.data.productItemId, productUrl: parsed.data.productUrl, taskId });
    telemetry.completed({ userId, assetId, taskId, status: 202 });
    return NextResponse.json({ ok: true, assetId, taskId, reviewStatus: "GENERATING" }, { status: 202 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : error instanceof ProviderCapabilityError ? 503 : 502;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể gửi yêu cầu tạo video." }, { status });
  }
}
