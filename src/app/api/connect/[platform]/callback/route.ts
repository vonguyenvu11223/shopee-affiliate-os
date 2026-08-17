import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertRateLimit, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { exchangeYouTubeCode } from "@/providers/publishing/youtube-publishing";
import { exchangeTikTokCode } from "@/providers/publishing/tiktok-publishing";
import { savePlatformConnection } from "@/repositories/platform-connection-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { OAUTH_STATE_COOKIE } from "@/app/api/connect/[platform]/route";

function settingsRedirect(request: Request, result: string) {
  const url = new URL("/settings/publishing", request.url);
  url.searchParams.set("result", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const telemetry = createRequestTelemetry(request, "publishing.connect_callback");
  try {
    assertRateLimit(request, 10, 60_000);
    const userId = await requireUserAuthorization();
    const { platform } = await params;
    const normalized = platform.toUpperCase();
    if (normalized !== "YOUTUBE" && normalized !== "TIKTOK") return settingsRedirect(request, "unsupported");

    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const store = await cookies();
    const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
    store.delete(OAUTH_STATE_COOKIE);

    if (requestUrl.searchParams.get("error")) { telemetry.rejected(400, "OAUTH_DENIED"); return settingsRedirect(request, "denied"); }
    if (!code || !state || !expectedState || state !== expectedState || !state.startsWith(`${normalized}:`)) {
      telemetry.rejected(400, "OAUTH_STATE_MISMATCH");
      return settingsRedirect(request, "state_mismatch");
    }

    if (normalized === "YOUTUBE") {
      const token = await exchangeYouTubeCode(code);
      await savePlatformConnection(userId, "YOUTUBE", { ...token, externalAccountName: "YouTube channel" });
    } else {
      const token = await exchangeTikTokCode(code);
      await savePlatformConnection(userId, "TIKTOK", { ...token, externalAccountName: "TikTok account" });
    }
    telemetry.completed({ userId, platform: normalized, status: 307 });
    return settingsRedirect(request, "connected");
  } catch (error) {
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return settingsRedirect(request, "failed");
  }
}
