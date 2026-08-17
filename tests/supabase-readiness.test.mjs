import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSupabaseReadiness, EXPECTED_SUPABASE_SCHEMA_VERSION } from "../src/lib/supabase/readiness-state.ts";

test("does not call Supabase ready when only configuration is missing", () => {
  const result = evaluateSupabaseReadiness({ configured: false, schemaVersion: null, databaseReachable: false, authReachable: false });
  assert.equal(result.ready, false);
  assert.equal(result.database.reason, "SUPABASE_CONFIG_MISSING");
});

test("requires the exact deployed schema version", () => {
  const result = evaluateSupabaseReadiness({ configured: true, schemaVersion: EXPECTED_SUPABASE_SCHEMA_VERSION - 1, databaseReachable: true, authReachable: true });
  assert.equal(result.ready, false);
  assert.equal(result.database.reason, "SCHEMA_MIGRATION_REQUIRED");
});

test("distinguishes an unreachable database from a missing migration", () => {
  const result = evaluateSupabaseReadiness({ configured: true, schemaVersion: null, databaseReachable: false, authReachable: true });
  assert.equal(result.database.reason, "DATABASE_UNREACHABLE");
});

test("becomes ready only when database schema and auth are reachable", () => {
  const result = evaluateSupabaseReadiness({ configured: true, schemaVersion: EXPECTED_SUPABASE_SCHEMA_VERSION, databaseReachable: true, authReachable: true });
  assert.equal(result.ready, true);
  assert.equal(result.database.status, "AVAILABLE");
  assert.equal(result.auth.status, "AVAILABLE");
});
