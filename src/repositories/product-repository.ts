import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { analyzeProductTrend } from "@/lib/intelligence/trend-engine";
import type { ProductOpportunity } from "@/lib/types";
import type { AffiliateExportData } from "@/lib/data/affiliate-data-types";
import { getDataFreshness } from "@/lib/data/freshness";
import { calculateProfitBaseline, estimateProductValue, type HistoricalExperimentObservation } from "@/lib/intelligence/profit-baseline-engine";
import { assessTestOpportunity } from "@/lib/intelligence/opportunity-engine";
import { createProductSnapshotFingerprint } from "@/lib/data/import-fingerprint";

const NullableNumeric = z.union([z.number(), z.string(), z.null()]).transform(value => value === null ? null : Number(value));
const DatabaseProductSchema = z.object({
  id: z.string().uuid(),
  item_id: z.string(),
  shop_name: z.string().nullable(),
  title: z.string(),
  category: z.string().nullable(),
  product_url: z.string().nullable(),
  product_snapshots: z.array(z.object({
    price: NullableNumeric,
    sold: NullableNumeric,
    commission_rate: NullableNumeric,
    commission_amount: NullableNumeric,
    captured_at: z.string(),
  })),
  affiliate_links: z.array(z.object({ affiliate_url: z.string(), created_at: z.string() })),
});
const DatabaseExperimentSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  budget: NullableNumeric,
  performance_metrics: z.array(z.object({
    views: NullableNumeric,
    clicks: NullableNumeric,
    orders: NullableNumeric,
    valid_orders: NullableNumeric,
    validated_commission: NullableNumeric,
  })),
});

const colorFor = (id: string) => {
  const palette = ["#fcddd1", "#dbe8d1", "#d9e4f7", "#eee1ba", "#ead9e6", "#d8ece8"];
  return palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
};

export async function getDatabaseAffiliateData(): Promise<AffiliateExportData | null> {
  if (!getSupabasePublicConfig()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return null;
  const { data, error } = await supabase.from("products").select(`
    id,item_id,shop_name,title,category,product_url,
    product_snapshots(price,sold,commission_rate,commission_amount,captured_at),
    affiliate_links(affiliate_url,created_at)
  `);
  if (error) throw new Error(`Không thể đọc Product DB: ${error.message}`);
  const rows = z.array(DatabaseProductSchema).parse(data ?? []);
  const { data: experimentData, error: experimentError } = await supabase.from("content_experiments").select(`
    id,product_id,budget,
    performance_metrics(views,clicks,orders,valid_orders,validated_commission)
  `);
  if (experimentError) throw new Error(`Không thể đọc Profit Baseline DB: ${experimentError.message}`);
  const experimentRows = z.array(DatabaseExperimentSchema).parse(experimentData ?? []);
  const categoryByProduct = new Map(rows.map(row => [row.id, row.category]));
  const observations: HistoricalExperimentObservation[] = experimentRows.flatMap(experiment => {
    if (!experiment.product_id || !experiment.performance_metrics.length) return [];
    const metrics = experiment.performance_metrics;
    const viewsComplete = metrics.every(metric => metric.views !== null);
    return [{
      experimentId: experiment.id,
      productId: experiment.product_id,
      category: categoryByProduct.get(experiment.product_id) ?? null,
      views: viewsComplete ? metrics.reduce((sum, metric) => sum + (metric.views ?? 0), 0) : null,
      clicks: metrics.reduce((sum, metric) => sum + (metric.clicks ?? 0), 0),
      orders: metrics.reduce((sum, metric) => sum + (metric.orders ?? 0), 0),
      validOrders: metrics.reduce((sum, metric) => sum + (metric.valid_orders ?? 0), 0),
      validatedCommission: metrics.reduce((sum, metric) => sum + (metric.validated_commission ?? 0), 0),
      contentCost: experiment.budget ?? 0,
    }];
  });
  const accountBaseline = calculateProfitBaseline(observations);
  const capturedTimes = new Set<string>();
  const valueByItemId = new Map<string, ReturnType<typeof estimateProductValue>>();
  let latestCapturedAt: string | null = null;
  let productsWithHistory = 0;
  const products: ProductOpportunity[] = rows.map(row => {
    const snapshots = [...row.product_snapshots].sort((left, right) => Date.parse(left.captured_at) - Date.parse(right.captured_at));
    snapshots.forEach(snapshot => capturedTimes.add(snapshot.captured_at));
    if (snapshots.length >= 2) productsWithHistory += 1;
    const latest = snapshots.at(-1);
    if (latest && (!latestCapturedAt || Date.parse(latest.captured_at) > Date.parse(latestCapturedAt))) latestCapturedAt = latest.captured_at;
    const trend = analyzeProductTrend(snapshots.map(snapshot => ({ sold: snapshot.sold, capturedAt: snapshot.captured_at })));
    const affiliateUrl = [...row.affiliate_links].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0]?.affiliate_url;
    const value = latest ? estimateProductValue(accountBaseline, latest.commission_amount ?? 0) : null;
    valueByItemId.set(row.item_id, value);
    return {
      id: row.item_id, name: row.title, category: row.category || "Chưa phân loại",
      price: latest?.price ?? 0, sold: latest?.sold ?? null,
      commissionRate: latest?.commission_rate ?? 0, commissionAmount: latest?.commission_amount ?? 0,
      ...trend, profitScore: null, contentFit: null, sellerScore: null, expectedProfit: value?.expectedNetProfit ?? null,
      expectedRoi: value?.expectedRoi ?? null, expectedProfitLow: value?.likelyNetProfitLow ?? null,
      expectedProfitHigh: value?.likelyNetProfitHigh ?? null, expectedCommissionPer1kViews: value?.expectedCommissionPer1kViews ?? null,
      breakEvenViews: value?.breakEvenViews ?? null, valueConfidence: value?.confidence ?? null,
      masterScore: null, recommendation: "REVIEW", halfLife: "Chưa đủ dữ liệu",
      color: colorFor(row.item_id), source: "AFFILIATE_EXPORT", shopName: row.shop_name ?? undefined,
      productUrl: row.product_url ?? undefined, affiliateUrl, importedAt: latest?.captured_at,
    };
  });
  const freshness = getDataFreshness(latestCapturedAt);
  const displayProducts = freshness.status === "STALE" ? products.map(product => ({
    ...product, salesVelocity24h: null, growth24h: null, acceleration: null,
    trendScore: null, trendStage: "DISCOVERY" as const, urgencyScore: null,
    confidence: null, dataQualityScore: 0, halfLife: "Dữ liệu đã cũ",
  })) : products;
  const assessedProducts = displayProducts.map(product => {
    const value = valueByItemId.get(product.id) ?? null;
    const assessment = assessTestOpportunity({
      trend: {
        salesVelocity24h: product.salesVelocity24h ?? null, growth24h: product.growth24h,
        acceleration: product.acceleration, trendScore: product.trendScore, trendStage: product.trendStage,
        urgencyScore: product.urgencyScore, confidence: product.confidence,
        dataQualityScore: product.dataQualityScore ?? 0, halfLife: product.halfLife,
      },
      value,
      freshness: freshness.status,
    });
    return { ...product, profitScore: assessment.profitScore, recommendation: assessment.recommendation, recommendationReason: assessment.reason, scoringVersion: assessment.scoringVersion };
  });
  return {
    products: assessedProducts, sourceFile: "Supabase Product DB", importedAt: latestCapturedAt,
    isReal: products.length > 0, snapshotCount: capturedTimes.size, productsWithHistory,
    recommendationReady: assessedProducts.some(product => product.recommendation === "TEST_NOW"),
    trendReady: capturedTimes.size >= 3 && productsWithHistory > 0 && freshness.status !== "STALE",
    freshness,
  };
}

interface PersistProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  sold: number | null;
  commissionRate: number;
  commissionAmount: number;
  shopName?: string;
  productUrl?: string;
  affiliateUrl?: string;
}

export async function persistProductImport(input: { userId: string; sourceFilename: string; csv: string; importedAt: string; products: PersistProduct[] }) {
  const contentHash = createProductSnapshotFingerprint(input.csv, input.importedAt);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { mode: "LOCAL_FILE" as const, duplicate: false, importRunId: null, contentHash };
  const { data, error } = await supabase.rpc("import_product_export", {
    p_source_filename: input.sourceFilename,
    p_content_hash: contentHash,
    p_captured_at: input.importedAt,
    p_products: input.products,
  });
  if (error) throw new Error(`Không thể lưu Product DB: ${error.message}`);
  const result = z.object({ importRunId: z.string().uuid(), duplicate: z.boolean(), rowCount: z.number().int().nonnegative() }).parse(data);
  return { mode: "SUPABASE" as const, duplicate: result.duplicate, importRunId: result.importRunId, contentHash };
}
