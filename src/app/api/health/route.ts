import { NextResponse } from "next/server";
import { getCapabilityReport } from "@/lib/system/capability-report";

export async function GET() {
  const report = await getCapabilityReport();
  return NextResponse.json({ service: "profitos", live: true, ...report }, { headers: { "Cache-Control": "no-store" } });
}
