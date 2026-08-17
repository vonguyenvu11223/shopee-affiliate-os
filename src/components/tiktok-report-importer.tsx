"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Upload } from "lucide-react";
import type { TikTokShopReportResult } from "@/lib/attribution/tiktok-shop-report";

const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;

export function TikTokReportImporter({ enabled }: { enabled: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TikTokShopReportResult | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file || !periodStart || !periodEnd) return;
    setLoading(true); setError(null); setResult(null); setDuplicate(false);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("periodStart", periodStart);
      body.set("periodEnd", periodEnd);
      const response = await fetch("/api/imports/tiktok-shop-report", { method: "POST", body });
      const payload = await response.json() as { result?: TikTokShopReportResult; duplicate?: boolean; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Không thể nhập báo cáo.");
      setResult(payload.result);
      setDuplicate(Boolean(payload.duplicate));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể nhập báo cáo."); }
    finally { setLoading(false); }
  };

  return <section className="table-card content-form">
    <div className="calculator-title"><div><p>TIKTOK SHOP AFFILIATE</p><h2>Nhập báo cáo Creator Center</h2></div><Upload size={22} /></div>
    <p className="form-help">TikTok Shop không có Sub_id — nền tảng tự quy đơn về từng video. Xuất báo cáo hiệu suất từ Creator Center rồi nhập vào đây để đối chiếu với video bạn đã đăng.</p>

    <div className="content-fields">
      <label className="full"><span>File báo cáo (CSV)</span><input type="file" accept=".csv,.tsv" disabled={!enabled} onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <label><span>Từ ngày</span><input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></label>
      <label><span>Đến ngày</span><input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></label>
    </div>

    <div className="content-actions">
      <button className="primary-button" disabled={!enabled || loading || !file || !periodStart || !periodEnd} onClick={() => void submit()}>
        {loading ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Nhập báo cáo
      </button>
    </div>
    {!enabled && <span className="ai-inline-error">Cần cấu hình Supabase để lưu báo cáo và attribution.</span>}
    {error && <span className="ai-inline-error">{error}</span>}

    {result && <div className="claim-preview">
      <b>{duplicate ? <><CheckCircle2 size={15} /> Báo cáo này đã được nhập trước đó</> : <><CheckCircle2 size={15} /> Đã nhập {result.rowCount} dòng</>}</b>
      <ul>
        <li>Đơn: {result.orders} · hợp lệ {result.validOrders}</li>
        <li>Hoa hồng đã đối soát: {money(result.validatedCommission)}</li>
        <li>Hoa hồng ước tính chưa đối soát: {money(result.pendingCommission)}</li>
        <li>Video quy được đơn: {result.attributionGroups.length}</li>
      </ul>
      {result.warnings.map(warning => <p key={warning} className="capability-note"><AlertTriangle size={13} /> {warning}</p>)}
    </div>}
  </section>;
}
