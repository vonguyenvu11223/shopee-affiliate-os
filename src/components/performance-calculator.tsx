"use client";

import { useMemo, useState } from "react";
import { Activity, BadgeDollarSign, CheckCircle2, CircleGauge, LoaderCircle, MousePointerClick, Save, ShoppingBag, WalletCards } from "lucide-react";
import { analyzePerformance, type ExperimentState, type FunnelDiagnosis } from "@/lib/intelligence/performance-engine";
import { getDecisionLineageStatus } from "@/lib/intelligence/decision-lineage";
import { ReportImporter, type ImportedMetrics, type ReportKind } from "@/components/report-importer";
import type { SavedExperimentOption } from "@/repositories/performance-repository";

type FormState = { views: string; clicks: string; orders: string; validOrders: string; validatedCommission: string; pendingCommission: string; contentCost: string };
const initialForm: FormState = { views: "", clicks: "0", orders: "0", validOrders: "0", validatedCommission: "0", pendingCommission: "0", contentCost: "0" };
const stateLabels: Record<ExperimentState, string> = { TESTING: "Đang test", VALIDATED: "Đã xác thực", SCALING: "Có thể scale", DECLINING: "Đang suy giảm", KILLED: "Nên dừng" };
const diagnosisLabels: Record<FunnelDiagnosis, string> = { INSUFFICIENT_DATA: "Chưa đủ dữ liệu", DISTRIBUTION: "Phân phối yếu", CREATIVE: "Creative chưa tốt", PRODUCT_OR_OFFER: "Sản phẩm/offer chưa phù hợp", ORDER_QUALITY: "Chất lượng đơn thấp", HEALTHY: "Funnel khỏe" };
const numberValue = (value: string) => Math.max(0, Number(value) || 0);
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

export function PerformanceCalculator({ databaseEnabled, experiments }: { databaseEnabled: boolean; experiments: SavedExperimentOption[] }) {
  const [form, setForm] = useState<FormState>(experiments[0] ? { ...initialForm, contentCost: String(experiments[0].budget) } : initialForm);
  const [experimentId, setExperimentId] = useState(experiments[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportLineage, setReportLineage] = useState<{ click: string | null; conversion: string | null }>({ click: null, conversion: null });
  const analysis = useMemo(() => analyzePerformance({ views: form.views.trim() === "" ? null : numberValue(form.views), clicks: numberValue(form.clicks), orders: numberValue(form.orders), validOrders: numberValue(form.validOrders), validatedCommission: numberValue(form.validatedCommission), pendingCommission: numberValue(form.pendingCommission), contentCost: numberValue(form.contentCost) }), [form]);
  const decisionLineage = getDecisionLineageStatus(analysis.state, reportLineage);
  const selected = experiments.find(item => item.id === experimentId);

  const update = (key: keyof FormState, value: string) => { setSaved(false); setForm(current => ({ ...current, [key]: value })); };
  const importMetrics = (metrics: ImportedMetrics) => { setSaved(false); setForm(current => ({ ...current, ...Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, String(value)])) })); };
  const updateLineage = (kind: ReportKind, importRunId: string | null) => setReportLineage(current => ({ ...current, [kind]: importRunId }));
  const changePeriod = (kind: "start" | "end", value: string) => {
    if (kind === "start") setPeriodStart(value); else setPeriodEnd(value);
    setReportLineage({ click: null, conversion: null });
    setForm(current => ({ ...initialForm, contentCost: current.contentCost }));
    setSaved(false); setSaveError(null);
  };
  const selectExperiment = (id: string) => {
    setExperimentId(id); setSaved(false); setSaveError(null);
    setReportLineage({ click: null, conversion: null });
    const match = experiments.find(item => item.id === id);
    if (match) setForm(current => ({ ...current, clicks: "0", orders: "0", validOrders: "0", validatedCommission: "0", pendingCommission: "0", contentCost: String(match.budget) }));
  };
  const savePerformance = async () => {
    if (!databaseEnabled || !experimentId) return;
    setSaving(true); setSaved(false); setSaveError(null);
    try {
      const response = await fetch("/api/experiments/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ experimentId, periodStart, periodEnd, views: form.views.trim() === "" ? null : numberValue(form.views), clicks: numberValue(form.clicks), orders: numberValue(form.orders), validOrders: numberValue(form.validOrders), validatedCommission: numberValue(form.validatedCommission), pendingCommission: numberValue(form.pendingCommission), clickImportRunId: reportLineage.click, conversionImportRunId: reportLineage.conversion }) });
      const payload = await response.json() as { error?: string; contentCost?: number };
      if (!response.ok) throw new Error(payload.error || "Không thể lưu số liệu.");
      if (typeof payload.contentCost === "number") setForm(current => ({ ...current, contentCost: String(payload.contentCost) }));
      setSaved(true);
    } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Không thể lưu số liệu."); }
    finally { setSaving(false); }
  };

  return <section className="calculator-layout">
    <div className="metric-form table-card">
      <div className="calculator-title"><div><p>USER INPUT · DỮ LIỆU THẬT</p><h2>Nhập kết quả của một nội dung</h2></div><Activity size={22} /></div>
      <p className="form-help">Lấy số liệu cùng một khoảng ngày từ TikTok/YouTube và báo cáo Shopee. Không nhập số ước lượng.</p>
      {databaseEnabled && <div className="field-grid experiment-selector"><label className="wide-field"><span>Experiment đã lưu</span><select value={experimentId} onChange={event => selectExperiment(event.target.value)}><option value="">Chọn experiment...</option>{experiments.map(item => <option value={item.id} key={item.id}>{item.title} · {item.trackingKey}</option>)}</select></label><label><span>Từ ngày</span><input type="date" value={periodStart} max={periodEnd} onChange={event => changePeriod("start", event.target.value)} /></label><label><span>Đến ngày</span><input type="date" value={periodEnd} min={periodStart} max={today()} onChange={event => changePeriod("end", event.target.value)} /></label></div>}
      {databaseEnabled && !experiments.length && <p className="ai-inline-error">Chưa có experiment. Hãy tạo và lưu một test trong Content Studio trước.</p>}
      <ReportImporter key={`${experimentId}-${periodStart}-${periodEnd}`} onImport={importMetrics} onLineage={updateLineage} databaseEnabled={databaseEnabled} trackingKey={selected?.trackingKey} periodStart={periodStart} periodEnd={periodEnd} />
      <div className="field-grid">
        <label><span>Lượt xem <small>TikTok/YouTube</small></span><input inputMode="numeric" value={form.views} placeholder="Không bắt buộc" onChange={event => update("views", event.target.value)} /></label><label><span>Clicks <small>Báo cáo click Shopee</small></span><input inputMode="numeric" value={form.clicks} onChange={event => update("clicks", event.target.value)} /></label>
        <label><span>Đơn hàng <small>Báo cáo chuyển đổi</small></span><input inputMode="numeric" value={form.orders} onChange={event => update("orders", event.target.value)} /></label><label><span>Đơn hợp lệ <small>Không hủy/hoàn</small></span><input inputMode="numeric" value={form.validOrders} onChange={event => update("validOrders", event.target.value)} /></label>
        <label><span>Hoa hồng xác nhận <small>VNĐ</small></span><input inputMode="numeric" value={form.validatedCommission} onChange={event => update("validatedCommission", event.target.value)} /></label><label><span>Hoa hồng chờ duyệt <small>VNĐ</small></span><input inputMode="numeric" value={form.pendingCommission} onChange={event => update("pendingCommission", event.target.value)} /></label>
        <label className="wide-field"><span>Chi phí nội dung/quảng bá <small>{databaseEnabled ? "Lấy từ experiment" : "VNĐ"}</small></span><input inputMode="numeric" value={form.contentCost} disabled={databaseEnabled} onChange={event => update("contentCost", event.target.value)} /></label>
      </div>
      <div className="content-actions"><button className="soft-button reset-button" type="button" onClick={() => { setForm(selected ? { ...initialForm, contentCost: String(selected.budget) } : initialForm); setSaved(false); }}>Xóa dữ liệu nhập</button>{databaseEnabled && <button className="primary-button" disabled={!experimentId || saving || !decisionLineage.ready} onClick={() => void savePerformance()}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Lưu & ra quyết định</button>}</div>
      {databaseEnabled && !decisionLineage.ready && <span className="ai-inline-error">Chỉ được lưu quyết định {analysis.state} sau khi nhập đủ Báo cáo click và Báo cáo chuyển đổi chính thức đúng Sub_id. Còn thiếu: {decisionLineage.missing.join(", ")}.</span>}
      {saved && <span className="draft-saved"><CheckCircle2 size={14} /> Đã lưu metric, decision và audit log vào Supabase</span>}{saveError && <span className="ai-inline-error">{saveError}</span>}
    </div>

    <div className={`analysis-result state-${analysis.state.toLowerCase()}`}>
      <div className="analysis-head"><div><span>QUYẾT ĐỊNH HIỆN TẠI</span><h2>{stateLabels[analysis.state]}</h2></div><strong>{analysis.confidence}%<small>độ tin cậy</small></strong></div>
      <div className="analysis-metrics"><article><MousePointerClick size={17} /><span>CTR</span><b>{percent(analysis.ctr)}</b></article><article><ShoppingBag size={17} /><span>Chuyển đổi</span><b>{percent(analysis.conversionRate)}</b></article><article><BadgeDollarSign size={17} /><span>EPC</span><b>{analysis.epc === null ? "—" : money(analysis.epc)}</b></article><article><WalletCards size={17} /><span>Lợi nhuận ròng</span><b>{money(analysis.netProfit)}</b></article><article><CircleGauge size={17} /><span>ROI</span><b>{analysis.roi === null ? "—" : `${analysis.roi.toFixed(2)}x`}</b></article><article><Activity size={17} /><span>Đơn hợp lệ</span><b>{percent(analysis.validOrderRate)}</b></article></div>
      <div className="diagnosis-box"><span>Chẩn đoán funnel</span><b>{diagnosisLabels[analysis.diagnosis]}</b><p>{analysis.nextBestAction}</p></div>
      <p className="calculation-note">Chỉ hoa hồng đã xác nhận được tính vào lợi nhuận. Hoa hồng chờ duyệt không được dùng để ra quyết định scale.</p>
    </div>
  </section>;
}
