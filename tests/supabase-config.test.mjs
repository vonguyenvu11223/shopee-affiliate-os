import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseAdminKey, getSupabasePublicConfig } from "../src/lib/supabase/config.ts";

const variables = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY",
];
const original = Object.fromEntries(variables.map(key => [key, process.env[key]]));

test.afterEach(() => {
  for (const key of variables) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test("prefers the modern Supabase publishable key", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_modern";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon";
  assert.deepEqual(getSupabasePublicConfig(), {
    url: "https://example.supabase.co", publishableKey: "sb_publishable_modern", keySource: "PUBLISHABLE",
  });
});

test("supports a legacy anon key without requiring it", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "legacy-anon";
  assert.equal(getSupabasePublicConfig()?.keySource, "LEGACY_ANON");
});

test("never treats a missing public key as configured", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(getSupabasePublicConfig(), null);
});

test("prefers the modern server secret key", () => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_modern";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role";
  assert.equal(getSupabaseAdminKey(), "sb_secret_modern");
});
