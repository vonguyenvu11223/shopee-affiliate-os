import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnvironment() {
  const file = resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnvironment();
const failures = [];
const required = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"];
for (const key of required) if (!process.env[key]?.trim()) failures.push(`Thiếu ${key}`);
if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
  failures.push("Thiếu NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (hoặc legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)");
}

for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") failures.push(`${key} phải dùng HTTPS trong production`);
  } catch { failures.push(`${key} không phải URL hợp lệ`); }
}

const migrationDirectory = resolve(process.cwd(), "supabase", "migrations");
const expectedMigrations = [
  "202608140001_foundation.sql",
  "202608140002_production_hardening.sql",
  "202608140003_performance_decision_rpc.sql",
  "202608140004_report_lineage.sql",
  "202608140005_atomic_product_import.sql",
  "202608140006_performance_periods.sql",
  "202608140007_decision_lineage_gate.sql",
  "202608140008_report_period_lineage.sql",
  "202608140009_schema_readiness.sql",
];
const migrations = existsSync(migrationDirectory) ? new Set(readdirSync(migrationDirectory)) : new Set();
for (const migration of expectedMigrations) if (!migrations.has(migration)) failures.push(`Thiếu migration ${migration}`);

if (failures.length) {
  console.error("PRODUCTION GATE: FAILED");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("PRODUCTION GATE: CONFIGURATION READY");
console.log("Tiếp theo: chạy migration, deploy, rồi yêu cầu /api/readiness trả HTTP 200.");
