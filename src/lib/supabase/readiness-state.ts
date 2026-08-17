export const EXPECTED_SUPABASE_SCHEMA_VERSION = 12;

export interface SupabaseReadinessState {
  ready: boolean;
  database: { status: "AVAILABLE" | "MANUAL_REQUIRED"; schemaVersion: number | null; expectedSchemaVersion: number; reason?: string };
  auth: { status: "AVAILABLE" | "MANUAL_REQUIRED"; reason?: string };
}

export function evaluateSupabaseReadiness(input: {
  configured: boolean;
  schemaVersion: number | null;
  databaseReachable: boolean;
  authReachable: boolean;
}): SupabaseReadinessState {
  if (!input.configured) return {
    ready: false,
    database: { status: "MANUAL_REQUIRED", schemaVersion: null, expectedSchemaVersion: EXPECTED_SUPABASE_SCHEMA_VERSION, reason: "SUPABASE_CONFIG_MISSING" },
    auth: { status: "MANUAL_REQUIRED", reason: "SUPABASE_CONFIG_MISSING" },
  };
  const schemaReady = input.databaseReachable && input.schemaVersion === EXPECTED_SUPABASE_SCHEMA_VERSION;
  const database = schemaReady
    ? { status: "AVAILABLE" as const, schemaVersion: input.schemaVersion, expectedSchemaVersion: EXPECTED_SUPABASE_SCHEMA_VERSION }
    : { status: "MANUAL_REQUIRED" as const, schemaVersion: input.schemaVersion, expectedSchemaVersion: EXPECTED_SUPABASE_SCHEMA_VERSION, reason: input.databaseReachable ? "SCHEMA_MIGRATION_REQUIRED" : "DATABASE_UNREACHABLE" };
  const auth = input.authReachable
    ? { status: "AVAILABLE" as const }
    : { status: "MANUAL_REQUIRED" as const, reason: "AUTH_UNREACHABLE" };
  return { ready: schemaReady && input.authReachable, database, auth };
}
