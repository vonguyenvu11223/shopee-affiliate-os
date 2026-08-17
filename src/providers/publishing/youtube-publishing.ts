import "server-only";

import type { ProviderStatus } from "@/providers/contracts";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];
const UPLOAD_TIMEOUT_MS = 120_000;

export interface YouTubeUploadInput {
  accessToken: string;
  title: string;
  description: string;
  media: Blob;
  mediaContentType: string;
  privacyStatus: "public" | "unlisted" | "private";
}

function readConfig() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID?.trim(),
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET?.trim(),
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001",
  };
}

export function getYouTubeCapability(): ProviderStatus {
  const { clientId, clientSecret } = readConfig();
  const configured = Boolean(clientId && clientSecret);
  return {
    connected: false,
    capability: configured ? "AVAILABLE" : "MANUAL_REQUIRED",
    lastSyncAt: null,
    reason: configured ? null : "Chưa cấu hình YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET. YouTube Data API miễn phí; tạo OAuth client trong Google Cloud Console.",
  };
}

export function getYouTubeRedirectUri(): string {
  return new URL("/api/connect/youtube/callback", readConfig().appUrl).toString();
}

export function buildYouTubeAuthUrl(state: string): string {
  const { clientId } = readConfig();
  if (!clientId) throw new Error("YOUTUBE_CLIENT_ID chưa được cấu hình.");
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getYouTubeRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope?: string }

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google OAuth trả về HTTP ${response.status}.`);
  return await response.json() as TokenResponse;
}

export async function exchangeYouTubeCode(code: string) {
  const { clientId, clientSecret } = readConfig();
  if (!clientId || !clientSecret) throw new Error("YouTube OAuth chưa được cấu hình.");
  const token = await requestToken({
    code, client_id: clientId, client_secret: clientSecret,
    redirect_uri: getYouTubeRedirectUri(), grant_type: "authorization_code",
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: new Date(Date.now() + token.expires_in * 1_000).toISOString(),
    scopes: token.scope?.split(" ") ?? SCOPES,
  };
}

export async function refreshYouTubeToken(refreshToken: string) {
  const { clientId, clientSecret } = readConfig();
  if (!clientId || !clientSecret) throw new Error("YouTube OAuth chưa được cấu hình.");
  const token = await requestToken({
    refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token",
  });
  return {
    accessToken: token.access_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1_000).toISOString(),
  };
}

/** Upload resumable: khởi tạo lấy Location rồi PUT toàn bộ file. */
export async function uploadYouTubeVideo(input: YouTubeUploadInput): Promise<string> {
  const metadata = {
    snippet: { title: input.title, description: input.description, categoryId: "22" },
    status: { privacyStatus: input.privacyStatus, selfDeclaredMadeForKids: false },
  };
  const initResponse = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": input.mediaContentType,
      "X-Upload-Content-Length": String(input.media.size),
    },
    body: JSON.stringify(metadata),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!initResponse.ok) throw new Error(`YouTube từ chối khởi tạo upload (HTTP ${initResponse.status}).`);
  const location = initResponse.headers.get("location");
  if (!location) throw new Error("YouTube không trả về địa chỉ upload.");

  const uploadResponse = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": input.mediaContentType, "Content-Length": String(input.media.size) },
    body: input.media,
    cache: "no-store",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!uploadResponse.ok) throw new Error(`YouTube từ chối file (HTTP ${uploadResponse.status}).`);
  const payload = await uploadResponse.json() as { id?: string };
  if (!payload.id) throw new Error("YouTube không trả về video id.");
  return payload.id;
}
