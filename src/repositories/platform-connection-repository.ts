import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { refreshYouTubeToken } from "@/providers/publishing/youtube-publishing";
import { refreshTikTokToken } from "@/providers/publishing/tiktok-publishing";
import type { PublishPlatform } from "@/lib/publishing/caption-builder";
import type { ConnectionStatus } from "@/lib/publishing/publish-gate";

const TOKEN_SKEW_MS = 120_000;

export interface ConnectionSummary {
  platform: PublishPlatform;
  accountName: string | null;
  status: ConnectionStatus;
  expiresAt: string | null;
}

/** Token chỉ đọc/ghi bằng service-role key; session browser không có policy nào trên bảng này. */
function requireAdmin() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Cần SUPABASE_SECRET_KEY để lưu kết nối nền tảng an toàn.");
  return admin;
}

export async function savePlatformConnection(userId: string, platform: PublishPlatform, input: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  externalAccountId?: string | null;
  externalAccountName?: string | null;
}) {
  const admin = requireAdmin();
  const { error } = await admin.from("platform_connections").upsert({
    user_id: userId,
    platform,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: input.expiresAt,
    scopes: input.scopes,
    external_account_id: input.externalAccountId ?? null,
    external_account_name: input.externalAccountName ?? null,
    status: "CONNECTED",
  }, { onConflict: "user_id,platform" });
  if (error) throw new Error(`Không thể lưu kết nối ${platform}: ${error.message}`);
}

export async function disconnectPlatform(userId: string, platform: PublishPlatform) {
  const admin = requireAdmin();
  const { error } = await admin.from("platform_connections").delete().eq("user_id", userId).eq("platform", platform);
  if (error) throw new Error(`Không thể ngắt kết nối ${platform}: ${error.message}`);
}

/** Trả access token còn hạn, tự refresh khi sắp hết. */
export async function getValidAccessToken(userId: string, platform: PublishPlatform): Promise<string> {
  const admin = requireAdmin();
  const { data, error } = await admin.from("platform_connections")
    .select("access_token, refresh_token, expires_at, status")
    .eq("user_id", userId).eq("platform", platform).maybeSingle();
  if (error) throw new Error(`Không thể đọc kết nối ${platform}: ${error.message}`);
  if (!data) throw new Error(`Chưa kết nối tài khoản ${platform}.`);
  if (data.status === "REVOKED") throw new Error(`Kết nối ${platform} đã bị thu hồi; cần cấp quyền lại.`);

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + TOKEN_SKEW_MS) return data.access_token as string;
  if (!data.refresh_token) {
    await admin.from("platform_connections").update({ status: "EXPIRED" }).eq("user_id", userId).eq("platform", platform);
    throw new Error(`Kết nối ${platform} đã hết hạn; cần cấp quyền lại.`);
  }

  try {
    if (platform === "YOUTUBE") {
      const refreshed = await refreshYouTubeToken(data.refresh_token as string);
      await admin.from("platform_connections").update({ access_token: refreshed.accessToken, expires_at: refreshed.expiresAt, status: "CONNECTED" })
        .eq("user_id", userId).eq("platform", platform);
      return refreshed.accessToken;
    }
    const refreshed = await refreshTikTokToken(data.refresh_token as string);
    await admin.from("platform_connections").update({ access_token: refreshed.accessToken, refresh_token: refreshed.refreshToken, expires_at: refreshed.expiresAt, status: "CONNECTED" })
      .eq("user_id", userId).eq("platform", platform);
    return refreshed.accessToken;
  } catch (caught) {
    await admin.from("platform_connections").update({ status: "EXPIRED" }).eq("user_id", userId).eq("platform", platform);
    throw new Error(caught instanceof Error ? caught.message : `Không thể làm mới kết nối ${platform}.`);
  }
}

/** Trạng thái hiển thị cho UI, đọc qua view không chứa token. */
export async function listConnectionStatuses(): Promise<ConnectionSummary[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("platform_connection_status").select("platform, external_account_name, status, expires_at");
  if (error) return [];
  return (data ?? []).map(row => ({
    platform: row.platform as PublishPlatform,
    accountName: row.external_account_name as string | null,
    status: row.status as ConnectionStatus,
    expiresAt: row.expires_at as string | null,
  }));
}

export function resolveConnectionStatus(summaries: ConnectionSummary[], platform: PublishPlatform): ConnectionStatus {
  return summaries.find(summary => summary.platform === platform)?.status ?? "MISSING";
}
