import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminKey, getSupabasePublicConfig } from "./config";

export function createSupabaseAdminClient() {
  const config = getSupabasePublicConfig();
  const adminKey = getSupabaseAdminKey();
  if (!config || !adminKey) return null;
  return createClient(config.url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
