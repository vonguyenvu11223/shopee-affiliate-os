import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export class RequestGuardError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

const attempts = new Map<string, number[]>();

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin && process.env.NODE_ENV !== "production") return;
  if (!origin) throw new RequestGuardError("Thiếu thông tin Origin.", 403);
  const requestUrl = new URL(request.url);
  const originUrl = new URL(origin);
  if (originUrl.host !== requestUrl.host || originUrl.protocol !== requestUrl.protocol) {
    throw new RequestGuardError("Yêu cầu khác nguồn bị từ chối.", 403);
  }
}

export function assertRateLimit(request: Request, limit = 6, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter(timestamp => now - timestamp < windowMs);
  if (recent.length >= limit) throw new RequestGuardError("Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.", 429);
  recent.push(now);
  attempts.set(key, recent);
}

export async function requireUserAuthorization(): Promise<string> {
  if (!getSupabasePublicConfig()) {
    if (process.env.NODE_ENV === "production") {
      throw new RequestGuardError("Thao tác ghi dữ liệu bị khóa cho đến khi Supabase Auth được cấu hình.", 503);
    }
    return "local-development";
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) throw new RequestGuardError("Bạn cần đăng nhập để thực hiện thao tác này.", 401);
  return data.user.id;
}
