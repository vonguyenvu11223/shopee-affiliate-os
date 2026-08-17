import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductOpportunity } from "@/lib/types";
import { analyzeProductTrend } from "@/lib/intelligence/trend-engine";
import type { AffiliateExportData } from "@/lib/data/affiliate-data-types";
import { getDatabaseAffiliateData } from "@/repositories/product-repository";
import { getDataFreshness } from "@/lib/data/freshness";
// Bo doc CSV thuan da tach ra tep rieng de scripts/watch-imports.mjs dung chung.
import { parseAffiliateExportCsv, colorFor } from "./affiliate-export-parser";
export { parseAffiliateExportCsv };

export type { AffiliateExportData } from "@/lib/data/affiliate-data-types";

const EMPTY_DATA: AffiliateExportData = {
  products: [], sourceFile: null, importedAt: null, isReal: false,
  snapshotCount: 0, productsWithHistory: 0, recommendationReady: false, trendReady: false,
  freshness: getDataFreshness(null),
};
const EXPORT_PATTERN = /^(Lấy link sản phẩm hàng loạt|shopee-products-).*\.csv$/i;
export async function getAffiliateExportData(): Promise<AffiliateExportData> {
  const databaseData = await getDatabaseAffiliateData();
  if (databaseData) return databaseData;
  const directory = path.join(process.cwd(), "data", "imports");
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_DATA;
    throw error;
  }

  const candidates = (await Promise.all(entries
    .filter(entry => entry.isFile() && EXPORT_PATTERN.test(entry.name))
    .map(async entry => ({ name: entry.name, stat: await fs.stat(path.join(directory, entry.name)) }))))
    .sort((left, right) => left.stat.mtimeMs - right.stat.mtimeMs);
  if (!candidates.length) return EMPTY_DATA;

  const snapshots = await Promise.all(candidates.map(async candidate => {
    const importedAt = candidate.stat.mtime.toISOString();
    const csv = await fs.readFile(path.join(directory, candidate.name), "utf8");
    return { ...candidate, importedAt, products: parseAffiliateExportCsv(csv, importedAt) };
  }));
  const latest = snapshots.at(-1)!;
  const seen = new Map<string, number>();
  snapshots.forEach(snapshot => snapshot.products.forEach(product => seen.set(product.id, (seen.get(product.id) ?? 0) + 1)));
  const productsWithHistory = [...seen.values()].filter(count => count >= 2).length;
  const freshness = getDataFreshness(latest.importedAt);

  const products = latest.products.map(product => {
    const history = snapshots.flatMap(snapshot => {
      const match = snapshot.products.find(candidate => candidate.id === product.id);
      return match ? [{ sold: match.sold, capturedAt: snapshot.importedAt }] : [];
    });
    const trend = analyzeProductTrend(history);
    return { ...product, ...trend, recommendation: "REVIEW" as const };
  });
  const displayProducts = freshness.status === "STALE" ? products.map(product => ({
    ...product, salesVelocity24h: null, growth24h: null, acceleration: null,
    trendScore: null, trendStage: "DISCOVERY" as const, urgencyScore: null,
    confidence: null, dataQualityScore: 0, halfLife: "Dữ liệu đã cũ",
  })) : products;

  return {
    products: displayProducts,
    sourceFile: latest.name,
    importedAt: latest.importedAt,
    isReal: latest.products.length > 0,
    snapshotCount: snapshots.length,
    productsWithHistory,
    recommendationReady: false,
    trendReady: snapshots.length >= 3 && productsWithHistory > 0 && freshness.status !== "STALE",
    freshness,
  };
}
