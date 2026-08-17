export type DataFreshnessStatus = "NO_DATA" | "FRESH" | "DUE" | "STALE";

export interface DataFreshness {
  status: DataFreshnessStatus;
  ageHours: number | null;
  nextImportDueAt: string | null;
}

export function getDataFreshness(importedAt: string | null, now = new Date()): DataFreshness {
  if (!importedAt) return { status: "NO_DATA", ageHours: null, nextImportDueAt: null };
  const importedTime = Date.parse(importedAt);
  if (!Number.isFinite(importedTime)) return { status: "NO_DATA", ageHours: null, nextImportDueAt: null };
  const ageHours = Math.max(0, (now.getTime() - importedTime) / 3_600_000);
  const status: DataFreshnessStatus = ageHours <= 24 ? "FRESH" : ageHours <= 72 ? "DUE" : "STALE";
  return { status, ageHours: Number(ageHours.toFixed(1)), nextImportDueAt: new Date(importedTime + 24 * 3_600_000).toISOString() };
}
