import { createHash } from "node:crypto";

function canonicalizeCsv(csv: string): string {
  return csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n").map(line => line.trimEnd()).join("\n").trimEnd();
}

export function createProductSnapshotFingerprint(csv: string, importedAt: string): string {
  const dayBucket = new Date(importedAt).toISOString().slice(0, 10);
  return createHash("sha256").update(`PRODUCT_EXPORT\n${dayBucket}\n${canonicalizeCsv(csv)}`).digest("hex");
}

export function createReportFingerprint(kind: "click" | "conversion", csv: string): string {
  return createHash("sha256").update(`${kind === "click" ? "CLICK_REPORT" : "CONVERSION_REPORT"}\n${canonicalizeCsv(csv)}`).digest("hex");
}
