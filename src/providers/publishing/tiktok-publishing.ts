import "server-only";

import type { ProviderStatus } from "@/providers/contracts";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const INBOX_VIDEO_INIT = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const CONTENT_INIT = "https://open.tiktokapis.com/v2/post/publish/content/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const SCOPES = ["video.upload"];
const UPLOAD_TIMEOUT_MS = 120_000;

function readConfig() {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY?.trim(),
    clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim(),
    verifiedUrlPrefix: process.env.TIKTOK_VERIFIED_URL_PREFIX?.trim() || null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001",
  };
}

export function getTikTokCapability(): ProviderStatus {
  const { clientKey, clientSecret } = readConfig();
  const configured = Boolean(clientKey && clientSecret);
  return {
    connected: false,
    capability: configured ? "AVAILABLE" : "MANUAL_REQUIRED",
    lastSyncAt: null,
    reason: configured
      ? "Chỉ đẩy được vào nháp trong TikTok của bạn (scope video.upload). Đăng công khai trực tiếp cần qua audit Content Posting API."
      : "Chưa cấu hình TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET. Đăng ký app tại developers.tiktok.com.",
  };
}

export function getTikTokVerifiedUrlPrefix(): string | null {
  return readConfig().verifiedUrlPrefix;
}

export function getTikTokRedirectUri(): string {
  return new URL("/api/connect/tiktok/callback", readConfig().appUrl).toString();
}

export function buildTikTokAuthUrl(state: string): string {
  const { clientKey } = readConfig();
  if (!clientKey) throw new Error("TIKTOK_CLIENT_KEY chưa được cấu hình.");
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("redirect_uri", getTikTokRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

interface TikTokTokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope?: string; open_id?: string; error?: string; error_description?: string }

async function requestToken(body: Record<string, string>): Promise<TikTokTokenResponse> {
  const { clientKey, clientSecret } = readConfig();
  if (!clientKey || !clientSecret) throw new Error("TikTok OAuth chưa được cấu hình.");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...body }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as TikTokTokenResponse;
  if (!response.ok || payload.error) throw new Error(`TikTok OAuth lỗi: ${payload.error_description ?? payload.error ?? response.status}.`);
  return payload;
}

export async function exchangeTikTokCode(code: string) {
  const token = await requestToken({ code, grant_type: "authorization_code", redirect_uri: getTikTokRedirectUri() });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: new Date(Date.now() + token.expires_in * 1_000).toISOString(),
    scopes: token.scope?.split(",") ?? SCOPES,
    externalAccountId: token.open_id ?? null,
  };
}

export async function refreshTikTokToken(refreshToken: string) {
  const token = await requestToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + token.expires_in * 1_000).toISOString(),
  };
}

async function callTikTok(url: string, accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json() as { data?: Record<string, unknown>; error?: { code?: string; message?: string } };
  const errorCode = payload.error?.code;
  if (!response.ok || (errorCode && errorCode !== "ok")) {
    throw new Error(`TikTok từ chối yêu cầu: ${payload.error?.message ?? errorCode ?? response.status}.`);
  }
  return payload.data ?? {};
}

/**
 * Video đi đường FILE_UPLOAD nên không cần domain đã xác minh.
 * Kết quả nằm trong hộp nháp TikTok của bạn; bạn mở app và bấm đăng.
 */
export async function uploadTikTokVideoToInbox(input: { accessToken: string; media: Blob }): Promise<string> {
  const size = input.media.size;
  const data = await callTikTok(INBOX_VIDEO_INIT, input.accessToken, {
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
  });
  const publishId = typeof data.publish_id === "string" ? data.publish_id : null;
  const uploadUrl = typeof data.upload_url === "string" ? data.upload_url : null;
  if (!publishId || !uploadUrl) throw new Error("TikTok không trả về publish_id/upload_url.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.media.type || "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: input.media,
    cache: "no-store",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!uploadResponse.ok) throw new Error(`TikTok từ chối file (HTTP ${uploadResponse.status}).`);
  return publishId;
}

/** Ảnh chỉ nhận PULL_FROM_URL, nên URL phải nằm trong domain bạn đã xác minh với TikTok. */
export async function uploadTikTokPhotosToInbox(input: { accessToken: string; photoUrls: string[]; title: string; description: string }): Promise<string> {
  const prefix = getTikTokVerifiedUrlPrefix();
  if (!prefix) throw new Error("Chưa cấu hình TIKTOK_VERIFIED_URL_PREFIX nên không thể đăng ảnh.");
  if (input.photoUrls.some(url => !url.startsWith(prefix))) throw new Error("Ảnh phải được host trên domain đã xác minh với TikTok.");

  const data = await callTikTok(CONTENT_INIT, input.accessToken, {
    media_type: "PHOTO",
    post_mode: "MEDIA_UPLOAD",
    post_info: { title: input.title, description: input.description },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: input.photoUrls },
  });
  const publishId = typeof data.publish_id === "string" ? data.publish_id : null;
  if (!publishId) throw new Error("TikTok không trả về publish_id.");
  return publishId;
}

export async function fetchTikTokPublishStatus(accessToken: string, publishId: string) {
  const data = await callTikTok(STATUS_URL, accessToken, { publish_id: publishId });
  return { status: typeof data.status === "string" ? data.status : "PROCESSING" };
}
