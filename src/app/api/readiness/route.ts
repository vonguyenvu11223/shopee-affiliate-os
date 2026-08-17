import { NextResponse } from "next/server";
import { getCapabilityReport } from "@/lib/system/capability-report";

export async function GET() {
  const report = await getCapabilityReport();
  return NextResponse.json(report, { status: report.status === "READY" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
