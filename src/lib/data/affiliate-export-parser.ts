import type { ProductOpportunity } from "../types";

/*
 * Phân tích CSV "Lấy link sản phẩm hàng loạt" của Shopee Affiliate.
 *
 * ═══ VÌ SAO TÁCH RA KHỎI `affiliate-export.ts` ═══
 *
 * Tệp kia kéo theo `product-repository` (đánh dấu `server-only`) và cả máy tính
 * xu hướng, nên chỉ chạy được bên trong Next.js. Nhưng bản thân việc đọc CSV thì
 * thuần tuý: vào một chuỗi, ra một mảng.
 *
 * Trộn chung khiến `scripts/watch-imports.mjs` không dùng lại được — Node thuần
 * không hiểu bí danh `@/`, và `server-only` thì ném lỗi ngay khi nạp. Cách duy
 * nhất còn lại là chép logic đọc CSV sang script, và khi đó hai bản sẽ trôi dạt:
 * web đọc file ra 20 sản phẩm, script đọc cùng file ra 19, mà không ai biết vì sao.
 *
 * ⚠️ Tệp này CHỈ được nhập bằng đường dẫn tương đối và không được phụ thuộc vào
 * bất cứ thứ gì của Next.js. Thêm một `@/` vào đây là script chết ngay.
 */

const REQUIRED_HEADERS = ["Mã sản phẩm", "Tên sản phẩm", "Giá", "Tỉ lệ hoa hồng", "Hoa hồng", "Link ưu đãi"];

/** Bộ đọc CSV tự viết — tên sản phẩm Shopee thường chứa dấu phẩy trong ngoặc kép. */
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

/** Shopee viết lượt bán dạng rút gọn: "30k+", "1tr+", "200k+". */
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

export function colorFor(id: string): string {
  const palette = ["#fcddd1", "#dbe8d1", "#d9e4f7", "#eee1ba", "#ead9e6", "#d8ece8"];
  return palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
}

export function parseAffiliateExportCsv(csv: string, importedAt: string): ProductOpportunity[] {
  const rows = parseCsv(csv.replace(/^﻿/, ""));
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
