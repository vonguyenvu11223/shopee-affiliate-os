"use client";

import { useRef, useState } from "react";
import { FileCheck2, LoaderCircle, Upload } from "lucide-react";
import { parseClickReportCsv, parseConversionReportCsv, type ClickReportResult, type ConversionReportResult } from "@/lib/attribution/report-parser";

export interface ImportedMetrics { clicks?: number; orders?: number; validOrders?: number; validatedCommission?: number; pendingCommission?: number }
export type ReportKind = "click" | "conversion";

export function ReportImporter({ onImport, onLineage, databaseEnabled, trackingKey, periodStart, periodEnd }: {
  onImport: (metrics: ImportedMetrics) => void;
  onLineage?: (kind: ReportKind, importRunId: string | null) => void;
  databaseEnabled: boolean;
  trackingKey?: string;
  periodStart: string;
  periodEnd: string;
}) {
  const clickInput = useRef<HTMLInputElement>(null);
  const conversionInput = useRef<HTMLInputElement>(null);
  const [clickStatus, setClickStatus] = useState("Chưa nhập");
  const [conversionStatus, setConversionStatus] = useState("Chưa nhập");
  const [loading, setLoading] = useState<ReportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyResult = (file: File, kind: ReportKind, result: ClickReportResult | ConversionReportResult, importRunId: string | null, duplicate = false) => {
    if (kind === "click") {
      const click = result as ClickReportResult;
      const group = trackingKey ? click.attributionGroups.find(item => item.trackingKey === trackingKey) : null;
      if (trackingKey && !group) throw new Error(`Báo cáo click không chứa đúng Sub_id: ${trackingKey}. Không gán số tổng cho experiment.`);
      const clicks = group?.clicks ?? click.clicks;
      onImport({ clicks });
      setClickStatus(`${file.name} · ${clicks.toLocaleString("vi-VN")} clicks${group ? " · khớp Sub_id" : " · số tổng"}${click.warnings.length ? " · có cảnh báo" : ""}${importRunId ? duplicate ? " · đã có trong DB" : " · đã lưu DB" : ""}`);
    } else {
      const conversion = result as ConversionReportResult;
      const group = trackingKey ? conversion.attributionGroups.find(item => item.trackingKey === trackingKey) : null;
      if (trackingKey && !group) throw new Error(`Báo cáo chuyển đổi không chứa đúng Sub_id: ${trackingKey}. Không gán số tổng cho experiment.`);
      const metrics = group ?? conversion;
      onImport({ orders: metrics.orders, validOrders: metrics.validOrders, validatedCommission: metrics.validatedCommission, pendingCommission: metrics.pendingCommission });
      setConversionStatus(`${file.name} · ${metrics.orders} đơn · ${metrics.validOrders} hoàn thành${group ? " · khớp Sub_id" : " · số tổng"}${conversion.warnings.length ? " · có cảnh báo" : ""}${importRunId ? duplicate ? " · đã có trong DB" : " · đã lưu DB" : ""}`);
    }
    onLineage?.(kind, trackingKey ? importRunId : null);
  };

  const read = async (file: File, kind: ReportKind) => {
    setError(null); onLineage?.(kind, null);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Hiện tại chỉ nhận file CSV xuất từ Shopee."); return; }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) { setError("File phải nhỏ hơn 10 MB."); return; }
    setLoading(kind);
    try {
      if (databaseEnabled) {
        const form = new FormData(); form.set("file", file); form.set("kind", kind); form.set("periodStart", periodStart); form.set("periodEnd", periodEnd);
        const response = await fetch("/api/imports/shopee-reports", { method: "POST", body: form });
        const payload = await response.json() as { result?: ClickReportResult | ConversionReportResult; importRunId?: string | null; duplicate?: boolean; error?: string };
        if (!response.ok || !payload.result) throw new Error(payload.error || "Không thể lưu báo cáo.");
        applyResult(file, kind, payload.result, payload.importRunId ?? null, payload.duplicate);
      } else {
        const csv = await file.text();
        const result = kind === "click" ? parseClickReportCsv(csv) : parseConversionReportCsv(csv);
        applyResult(file, kind, result, null);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đọc báo cáo."); }
    finally { setLoading(null); }
  };

  return <div className="report-importer">
    <div className="report-import-head"><div><p>SHOPEE REPORT IMPORT</p><h3>Nạp báo cáo cùng một khoảng ngày</h3></div><FileCheck2 size={20} /></div>
    <div className="report-files">
      <div><span>Báo cáo click</span><b>{clickStatus}</b><button className="soft-button" disabled={loading !== null} type="button" onClick={() => clickInput.current?.click()}>{loading === "click" ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} Chọn CSV</button><input ref={clickInput} hidden type="file" accept=".csv,text/csv" onChange={event => { const file = event.target.files?.[0]; if (file) void read(file, "click"); event.target.value = ""; }} /></div>
      <div><span>Báo cáo chuyển đổi</span><b>{conversionStatus}</b><button className="soft-button" disabled={loading !== null} type="button" onClick={() => conversionInput.current?.click()}>{loading === "conversion" ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />} Chọn CSV</button><input ref={conversionInput} hidden type="file" accept=".csv,text/csv" onChange={event => { const file = event.target.files?.[0]; if (file) void read(file, "conversion"); event.target.value = ""; }} /></div>
    </div>
    {error && <p className="report-error">{error}</p>}
    <p className="report-note">Kỳ đang gắn: <b>{periodStart} → {periodEnd}</b>. {databaseEnabled ? "CSV được parse phía máy chủ; chỉ hash, metadata và số tổng hợp được lưu để audit, không lưu nội dung file gốc." : "CSV chỉ được đọc trong trình duyệt. Cấu hình Supabase để lưu lineage và chống nhập trùng."} Luôn chọn cùng khoảng ngày cho cả hai báo cáo.</p>
  </div>;
}
