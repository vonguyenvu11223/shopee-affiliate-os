import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProductOpportunity } from "@/lib/types";
import { analyzeProductTrend } from "@/lib/intelligence/trend-engine";
import type { AffiliateExportData } from "@/lib/data/affiliate-data-types";
import { getDatabaseAffiliateData } from "@/repositories/product-repository";
import { getDataFreshness } from "@/lib/data/freshness";

export type { AffiliateExportData } from "@/lib/data/affiliate-data-types";

const EMPTY_DATA: AffiliateExportData = {
  products: [], sourceFile: null, importedAt: null, isReal: false,
  snapshotCount: 0, productsWithHistory: 0, recommendationReady: false, trendReady: false,
  freshness: getDataFreshness(null),
};
const EXPORT_PATTERN = /^(Lấy link sản phẩm hàng loạt|shopee-products-).*\.csv$/i;
const REQUIRED_HEADERS = ["Mã sản phẩm", "Tên sản phẩm", "Giá", "Tỉ lệ hoa hồng", "Hoa hồng", "Link ưu đãi"];

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

function parseCompactNumber(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(/\s|\+/g, "");
  if (!value) return null;
  const compact = value.match(/^([\d.,]+)(k|tr|m)$/);
  if (compact) {
    const base = Number(compact[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(base)) return null;
    return Math.round(base * (compact[2] === "k" ? 1_000 : 1_000_000));
  }
  const number = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseMoney(raw: string): number {
  return parseCompactNumber(raw.replace(/[₫đ]/gi, "")) ?? 0;
}

function parseRate(raw: string): number {
  const value = Number(raw.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(value) ? value : 0;
}

function colorFor(id: string): string {
  const palette = ["#fcddd1", "#dbe8d1", "#d9e4f7", "#eee1ba", "#ead9e6", "#d8ece8"];
  return palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
}

export function parseAffiliateExportCsv(csv: string, importedAt: string): ProductOpportunity[] {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map(header => header.trim());
  if (!headers || REQUIRED_HEADERS.some(header => !headers.includes(header))) {
    throw new Error("File không đúng định dạng xuất link hàng loạt của Shopee Affiliate.");
  }
  const index = new Map(headers.map((header, position) => [header, position]));
  const value = (row: string[], name: string) => row[index.get(name) ?? -1]?.trim() ?? "";

  return rows.flatMap((row): ProductOpportunity[] => {
    const id = value(row, "Mã sản phẩm");
    const name = value(row, "Tên sản phẩm");
    if (!id || !name) return [];
    return [{
      id, name, category: "Chưa phân loại", price: parseMoney(value(row, "Giá")),
      sold: parseCompactNumber(value(row, "Doanh thu")), growth24h: null, acceleration: null,
      commissionRate: parseRate(value(row, "Tỉ lệ hoa hồng")), commissionAmount: parseMoney(value(row, "Hoa hồng")),
      trendStage: "DISCOVERY", trendScore: null, profitScore: null, contentFit: null,
      urgencyScore: null, sellerScore: null, confidence: null, expectedProfit: null,
      expectedRoi: null, masterScore: null, recommendation: "REVIEW", halfLife: "Chưa đủ dữ liệu",
      color: colorFor(id), source: "AFFILIATE_EXPORT", shopName: value(row, "Tên cửa hàng"),
      productUrl: value(row, "Link sản phẩm"), affiliateUrl: value(row, "Link ưu đãi"), importedAt,
    }];
  });
}

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
