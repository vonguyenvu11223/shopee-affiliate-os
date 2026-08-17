import "server-only";

import { getAffiliateExportData } from "@/lib/data/affiliate-export";
import { probeSupabaseReadiness } from "@/lib/supabase/readiness";
import { getOpenAiCapability } from "@/providers/ai/openai-content";
import { getTopViewCapability } from "@/providers/ai/topview-video";
import { getYouTubeCapability } from "@/providers/publishing/youtube-publishing";
import { getTikTokCapability } from "@/providers/publishing/tiktok-publishing";
import { getJobQueueCapability } from "@/providers/jobs/disabled-job-queue";

export async function getCapabilityReport() {
  const [products, supabase] = await Promise.all([
    getAffiliateExportData().catch(() => null),
    probeSupabaseReadiness(),
  ]);
  const ai = getOpenAiCapability();
  const video = getTopViewCapability();
  const jobs = getJobQueueCapability();
  const productionReady = supabase.ready;
  return {
    status: productionReady ? "READY" as const : "ACTION_REQUIRED" as const,
    checkedAt: new Date().toISOString(),
    capabilities: {
      shopeeProductExport: { status: products?.isReal ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const, products: products?.products.length ?? 0, snapshots: products?.snapshotCount ?? 0, freshness: products?.freshness ?? null },
      shopeeReports: { status: "MANUAL_REQUIRED" as const, mode: "OFFICIAL_CSV" },
      affiliatePrograms: {
        shopee: { status: "AVAILABLE" as const, attribution: "SUB_ID" as const },
        tiktokShop: { status: "MANUAL_REQUIRED" as const, attribution: "NATIVE_CONTENT" as const, reason: "Nhập báo cáo Creator Center thủ công; Affiliate Creator API cần duyệt qua TikTok Shop Partner Center." },
      },
      shopeeOpenApi: { status: "REQUIRES_PERMISSION" as const },
      productFeed: { status: "UNAVAILABLE" as const },
      database: supabase.database,
      auth: supabase.auth,
      serverImports: { status: supabase.ready ? "AVAILABLE" as const : "MANUAL_REQUIRED" as const, reason: supabase.ready ? undefined : "SUPABASE_NOT_VERIFIED" },
      aiContent: { status: ai.status, model: ai.model },
      aiVideo: { status: video.capability, generator: "TOPVIEW", reason: video.reason ?? undefined, manualIngest: "AVAILABLE" as const, reviewGate: "REQUIRED" as const },
      deterministicProfitEngine: { status: "AVAILABLE" as const },
      autoPublish: {
        youtube: { status: getYouTubeCapability().capability, mode: "DIRECT_PUBLIC" as const, reason: getYouTubeCapability().reason ?? undefined },
        tiktok: { status: getTikTokCapability().capability, mode: "DRAFT_INBOX" as const, reason: getTikTokCapability().reason ?? undefined },
        shopeeVideo: { status: "UNAVAILABLE" as const, reason: "Không có API đăng công khai cho tài khoản affiliate." },
      },
      jobQueue: { status: jobs.capability, reason: jobs.reason },
    },
  };
}
