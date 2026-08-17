import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertRateLimit, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { buildYouTubeAuthUrl, getYouTubeCapability } from "@/providers/publishing/youtube-publishing";
import { buildTikTokAuthUrl, getTikTokCapability } from "@/providers/publishing/tiktok-publishing";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";

export const OAUTH_STATE_COOKIE = "profitos_oauth_state";

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const telemetry = createRequestTelemetry(request, "publishing.connect");
  try {
    assertRateLimit(request, 10, 60_000);
    await requireUserAuthorization();
    const { platform } = await params;
    const normalized = platform.toUpperCase();
    if (normalized !== "YOUTUBE" && normalized !== "TIKTOK") {
      return NextResponse.json({ error: "Nền tảng chưa được hỗ trợ." }, { status: 400 });
    }
    const capability = normalized === "YOUTUBE" ? getYouTubeCapability() : getTikTokCapability();
    if (capability.capability !== "AVAILABLE") {
      telemetry.rejected(503, "OAUTH_NOT_CONFIGURED");
      return NextResponse.json({ error: capability.reason }, { status: 503 });
    }

    const state = `${normalized}:${randomUUID()}`;
    const store = await cookies();
    store.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    const authUrl = normalized === "YOUTUBE" ? buildYouTubeAuthUrl(state) : buildTikTokAuthUrl(state);
    telemetry.completed({ platform: normalized, status: 307 });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể bắt đầu kết nối." }, { status });
  }
}
