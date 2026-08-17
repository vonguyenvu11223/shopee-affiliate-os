import { NextResponse } from "next/server";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { creditToVnd, getTopViewCapability, queryVideoTask } from "@/providers/ai/topview-video";
import { applyTopViewTaskResult, getContentAsset } from "@/repositories/content-asset-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { summarizeClaimRisk } from "@/lib/content/claim-detector";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Poll trạng thái job TopView. Client gọi mỗi 4 giây; request này luôn ngắn. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const telemetry = createRequestTelemetry(request, "topview.poll");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 90, 60_000);
    await requireUserAuthorization();
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Asset không hợp lệ." }, { status: 400 });

    const asset = await getContentAsset(id);
    if (!asset) return NextResponse.json({ error: "Không tìm thấy asset." }, { status: 404 });
    if (asset.reviewStatus !== "GENERATING" || !asset.providerTaskId) {
      return NextResponse.json({ ok: true, reviewStatus: asset.reviewStatus, videoUrl: asset.videoUrl, detectedClaims: asset.detectedClaims, risk: summarizeClaimRisk(asset.detectedClaims) });
    }
    if (getTopViewCapability().capability !== "AVAILABLE") {
      return NextResponse.json({ ok: true, reviewStatus: asset.reviewStatus, pending: true });
    }

    const task = await queryVideoTask(asset.providerTaskId);
    const applied = await applyTopViewTaskResult(id, { ...task, costVnd: creditToVnd(task.creditCost) });
    telemetry.completed({ assetId: id, taskState: task.state, status: 200 });
    return NextResponse.json({
      ok: true,
      reviewStatus: applied.reviewStatus,
      videoUrl: task.videoUrl,
      detectedClaims: applied.detectedClaims,
      risk: summarizeClaimRisk(applied.detectedClaims),
      failureReason: task.failureReason,
    });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 502;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể kiểm tra trạng thái video." }, { status });
  }
}
