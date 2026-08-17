export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
  keySource: "PUBLISHABLE" | "LEGACY_ANON";
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const modernKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const legacyKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishableKey = modernKey || legacyKey;
  if (!url || !publishableKey) return null;
  try { new URL(url); }
  catch { throw new Error("NEXT_PUBLIC_SUPABASE_URL không phải URL hợp lệ."); }
  return { url, publishableKey, keySource: modernKey ? "PUBLISHABLE" : "LEGACY_ANON" };
}

export function getSupabaseAdminKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function getSupabaseCapability() {
  const publicConfig = getSupabasePublicConfig();
  return {
    database: publicConfig ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const,
    auth: publicConfig ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const,
    serverImports: publicConfig ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const,
  };
}
