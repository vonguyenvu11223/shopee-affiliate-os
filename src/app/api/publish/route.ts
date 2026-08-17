import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { buildPublishCaption } from "@/lib/publishing/caption-builder";
import { evaluatePublishGate, describePublishBlocker } from "@/lib/publishing/publish-gate";
import { getContentAsset } from "@/repositories/content-asset-repository";
import { getValidAccessToken, listConnectionStatuses, resolveConnectionStatus } from "@/repositories/platform-connection-repository";
import { recordPublishAttempt } from "@/repositories/publish-repository";
import { uploadYouTubeVideo } from "@/providers/publishing/youtube-publishing";
import { getTikTokVerifiedUrlPrefix, uploadTikTokPhotosToInbox, uploadTikTokVideoToInbox } from "@/providers/publishing/tiktok-publishing";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

const PublishRequestSchema = z.object({
  assetId: z.string().uuid(),
  platform: z.enum(["YOUTUBE", "TIKTOK"]),
  program: z.enum(["SHOPEE", "TIKTOK_SHOP"]).default("SHOPEE"),
  mediaKind: z.enum(["VIDEO", "PHOTO"]).default("VIDEO"),
  productName: z.string().trim().min(1).max(500),
  hook: z.string().trim().max(500).default(""),
  cta: z.string().trim().max(500).default(""),
  affiliateUrl: z.string().trim().url().max(2_000).nullable().default(null),
  trackingKey: z.string().trim().min(1).max(300).nullable().default(null),
  showcaseProductId: z.string().trim().min(1).max(120).nullable().default(null),
  bioLinkConfigured: z.boolean().default(false),
  privacyStatus: z.enum(["public", "unlisted", "private"]).default("public"),
});

async function downloadMedia(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Không tải được media (HTTP ${response.status}).`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_MEDIA_BYTES) throw new Error("File vượt quá 200 MB.");
  const blob = await response.blob();
  if (blob.size > MAX_MEDIA_BYTES) throw new Error("File vượt quá 200 MB.");
  if (blob.size === 0) throw new Error("File rỗng.");
  return blob;
}

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "publishing.publish");
  try {
    assertSameOrigin(request);
    assertRateLimit(request, 8, 60_000);
    const userId = await requireUserAuthorization();
    const parsed = PublishRequestSchema.safeParse(await request.json());
    if (!parsed.success) { telemetry.rejected(400, "INVALID_INPUT"); return NextResponse.json({ error: "Dữ liệu đăng không hợp lệ." }, { status: 400 }); }
    const input = parsed.data;

    const asset = await getContentAsset(input.assetId);
    if (!asset) return NextResponse.json({ error: "Không tìm thấy asset." }, { status: 404 });

    const connections = await listConnectionStatuses();
    const gate = evaluatePublishGate({
      platform: input.platform,
      program: input.program,
      mediaKind: input.mediaKind,
      reviewStatus: asset.reviewStatus,
      mediaUrl: asset.videoUrl,
      affiliateUrl: input.affiliateUrl,
      trackingKey: input.trackingKey,
      showcaseProductId: input.showcaseProductId,
      bioLinkConfigured: input.bioLinkConfigured,
      connectionStatus: resolveConnectionStatus(connections, input.platform),
      aigcLabelRequired: asset.aigcLabelRequired,
      aigcLabelAcknowledged: asset.aigcLabelAcknowledged,
      verifiedUrlPrefix: getTikTokVerifiedUrlPrefix(),
    });
    if (!gate.publishable) {
      telemetry.rejected(422, gate.blockers.join(","));
      return NextResponse.json({ error: "Chưa đủ điều kiện đăng.", blockers: gate.blockers.map(describePublishBlocker) }, { status: 422 });
    }

    const caption = buildPublishCaption({
      platform: input.platform, program: input.program, productName: input.productName,
      hook: input.hook, cta: input.cta,
      affiliateUrl: input.affiliateUrl, trackingKey: input.trackingKey,
      aiGenerated: asset.provenance !== "USER_AUTHORED",
      bioLinkConfigured: input.bioLinkConfigured,
    });

    const accessToken = await getValidAccessToken(userId, input.platform);
    let externalId: string;
    try {
      if (input.platform === "YOUTUBE") {
        const media = await downloadMedia(asset.videoUrl!);
        externalId = await uploadYouTubeVideo({
          accessToken, title: caption.title, description: caption.description,
          media, mediaContentType: media.type || "video/mp4", privacyStatus: input.privacyStatus,
        });
      } else if (input.mediaKind === "PHOTO") {
        externalId = await uploadTikTokPhotosToInbox({ accessToken, photoUrls: [asset.videoUrl!], title: caption.title, description: caption.description });
      } else {
        const media = await downloadMedia(asset.videoUrl!);
        externalId = await uploadTikTokVideoToInbox({ accessToken, media });
      }
    } catch (uploadError) {
      const reason = uploadError instanceof Error ? uploadError.message : "Upload thất bại.";
      await recordPublishAttempt({
        assetId: input.assetId, platform: input.platform, program: input.program, mode: gate.mode,
        mediaKind: input.mediaKind, externalId: null, status: "FAILED", trackingKey: input.trackingKey,
        affiliateUrl: input.affiliateUrl, showcaseProductId: input.showcaseProductId,
        linkStrategy: caption.linkStrategy, caption: caption.description, failureReason: reason,
      });
      throw uploadError;
    }

    const attemptId = await recordPublishAttempt({
      assetId: input.assetId, platform: input.platform, program: input.program, mode: gate.mode,
      mediaKind: input.mediaKind, externalId,
      status: gate.mode === "DIRECT_PUBLIC" ? "PUBLISHED" : "SUBMITTED",
      trackingKey: input.trackingKey, affiliateUrl: input.affiliateUrl,
      showcaseProductId: input.showcaseProductId, linkStrategy: caption.linkStrategy,
      caption: caption.description, failureReason: null,
    });

    telemetry.completed({ userId, assetId: input.assetId, platform: input.platform, mode: gate.mode, attemptId, status: 201 });
    revalidatePath("/content");
    return NextResponse.json({
      ok: true, attemptId, externalId, mode: gate.mode,
      truncated: caption.truncated,
      message: gate.mode === "DIRECT_PUBLIC" ? "Đã đăng công khai." : "Đã đẩy vào hộp nháp; mở app để bấm đăng.",
    }, { status: 201 });
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 502;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đăng nội dung." }, { status });
  }
}
