import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";
import { getSupabaseCapability } from "@/lib/supabase/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfitOS — Shopee Affiliate",
  description: "AI Affiliate Decision & Profit Operating System",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = await getAffiliateExportData();
  const capability = getSupabaseCapability();
  return <html lang="vi"><body><AppShell realData={data.isReal} productCount={data.products.length} authEnabled={capability.auth === "AVAILABLE"}>{children}</AppShell></body></html>;
}
