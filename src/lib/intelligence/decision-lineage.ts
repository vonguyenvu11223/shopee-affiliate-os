import type { ExperimentState } from "@/lib/intelligence/performance-engine";

export interface DecisionLineageStatus {
  required: boolean;
  ready: boolean;
  missing: Array<"CLICK" | "CONVERSION">;
}

export function getDecisionLineageStatus(
  state: ExperimentState,
  lineage: { click: string | null; conversion: string | null },
): DecisionLineageStatus {
  if (state === "TESTING") return { required: false, ready: true, missing: [] };
  const missing: Array<"CLICK" | "CONVERSION"> = [];
  if (!lineage.click) missing.push("CLICK");
  if (!lineage.conversion) missing.push("CONVERSION");
  return { required: true, ready: missing.length === 0, missing };
}
