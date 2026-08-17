import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { evaluateSupabaseReadiness, type SupabaseReadinessState } from "@/lib/supabase/readiness-state";

export async function probeSupabaseReadiness(): Promise<SupabaseReadinessState> {
  let config;
  try { config = getSupabasePublicConfig(); }
  catch { return evaluateSupabaseReadiness({ configured: true, schemaVersion: null, databaseReachable: false, authReachable: false }); }
  if (!config) return evaluateSupabaseReadiness({ configured: false, schemaVersion: null, databaseReachable: false, authReachable: false });
  const client = createClient(config.url, config.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const [schemaResult, authResponse] = await Promise.all([
      client.rpc("profitos_schema_version"),
      fetch(new URL("/auth/v1/settings", config.url), { headers: { apikey: config.publishableKey }, cache: "no-store", signal: AbortSignal.timeout(5_000) }),
    ]);
    const version = schemaResult.error ? null : Number(schemaResult.data);
    return evaluateSupabaseReadiness({
      configured: true,
      schemaVersion: Number.isInteger(version) ? version : null,
      databaseReachable: !schemaResult.error,
      authReachable: authResponse.ok,
    });
  } catch {
    return evaluateSupabaseReadiness({ configured: true, schemaVersion: null, databaseReachable: false, authReachable: false });
  }
}
