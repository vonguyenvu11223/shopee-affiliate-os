import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseAffiliateExportCsv } from "@/lib/data/affiliate-export";
import { assertRateLimit, assertSameOrigin, RequestGuardError, requireUserAuthorization } from "@/lib/security/request-guards";
import { persistProductImport } from "@/repositories/product-repository";
import { createRequestTelemetry } from "@/lib/observability/request-telemetry";
import { createProductSnapshotFingerprint } from "@/lib/data/import-fingerprint";
import { docMocXuatTuTenFile } from "@/lib/data/export-timestamp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const telemetry = createRequestTelemetry(request, "shopee_product_export.import");
  try {
    assertSameOrigin(request);
    assertRateLimit(request);
    const userId = await requireUserAuthorization();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Chưa chọn file CSV." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Chỉ chấp nhận file CSV." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File phải nhỏ hơn 5 MB." }, { status: 400 });

    const csv = await file.text();
    /*
     * Ưu tiên thời điểm XUẤT file (đọc từ tên file Shopee đặt), không phải thời
     * điểm nhập. Toàn bộ giá trị của công cụ này nằm ở việc đo thay đổi theo thời
     * gian; đóng dấu lúc bấm nhập thì nhập hai file cũ trong cùng một buổi sẽ cho
     * ra hai snapshot cách nhau vài phút — velocity vô nghĩa mà không có gì báo.
     * Không đọc được thì mới lùi về hiện tại. Xem `lib/data/export-timestamp.ts`.
     */
    const importedAt = docMocXuatTuTenFile(file.name) ?? new Date().toISOString();
    const products = parseAffiliateExportCsv(csv, importedAt);
    if (!products.length) return NextResponse.json({ error: "File không có sản phẩm hợp lệ." }, { status: 400 });

    const persistence = await persistProductImport({ userId, sourceFilename: file.name, csv, importedAt, products });
    if (persistence.duplicate) { telemetry.completed({ userId, productCount: products.length, duplicate: true, importRunId: persistence.importRunId, status: 200 }); return NextResponse.json({ ok: true, count: products.length, duplicate: true, mode: persistence.mode }); }

    let filename: string | null = null;
    if (persistence.mode === "LOCAL_FILE") {
      const directory = path.join(process.cwd(), "data", "imports");
      await fs.mkdir(directory, { recursive: true });
      const existingEntries = await fs.readdir(directory, { withFileTypes: true });
      for (const entry of existingEntries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".csv")) continue;
        const existingPath = path.join(directory, entry.name);
        const [existingCsv, stat] = await Promise.all([fs.readFile(existingPath, "utf8"), fs.stat(existingPath)]);
        if (createProductSnapshotFingerprint(existingCsv, stat.mtime.toISOString()) === persistence.contentHash) {
          telemetry.completed({ userId, productCount: products.length, duplicate: true, importRunId: null, status: 200 });
          return NextResponse.json({ ok: true, count: products.length, duplicate: true, mode: persistence.mode });
        }
      }
      filename = `shopee-products-${importedAt.slice(0, 10)}-${persistence.contentHash.slice(0, 12)}.csv`;
      try { await fs.writeFile(path.join(directory, filename), csv, { encoding: "utf8", flag: "wx" }); }
      catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code === "EEXIST") {
          telemetry.completed({ userId, productCount: products.length, duplicate: true, importRunId: null, status: 200 });
          return NextResponse.json({ ok: true, count: products.length, duplicate: true, mode: persistence.mode });
        }
        throw writeError;
      }
    }
    revalidatePath("/", "layout");
    telemetry.completed({ userId, productCount: products.length, duplicate: false, importRunId: persistence.importRunId, status: 200 });
    return NextResponse.json({ ok: true, count: products.length, filename, mode: persistence.mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể nhập dữ liệu.";
    const status = error instanceof RequestGuardError ? error.status : 400;
    telemetry.failed(error, { status });
    return NextResponse.json({ error: message }, { status });
  }
}
