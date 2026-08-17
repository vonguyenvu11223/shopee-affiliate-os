"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, ClipboardCheck, LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { buildManualBrief } from "@/lib/content/brief";
import type { ContentAiOutput } from "@/lib/ai/content-schema";
import { createTrackingPlan } from "@/lib/attribution/tracking";

interface ProductOption { id: string; name: string; price: number; commissionAmount: number; affiliateUrl?: string }
interface Draft { id: string; productId: string; platform: string; channel: string; contentKey: string; variant: string; campaign: string; audience: string; painPoint: string; hook: string; proof: string; cta: string; budget: string; createdAt: string }

const safeKey = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "").slice(0, 40);
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export function ContentTestBuilder({ products, aiEnabled, databaseEnabled }: { products: ProductOption[]; aiEnabled: boolean; databaseEnabled: boolean }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [platform, setPlatform] = useState<"tiktok" | "youtube">("tiktok");
  const [channel, setChannel] = useState("");
  const [variant, setVariant] = useState("v1");
  const [campaign, setCampaign] = useState("");
  const [contentKey, setContentKey] = useState(() => products[0] ? `${safeKey(products[0].name).slice(0, 18)}001` : "");
  const [audience, setAudience] = useState("");
  const [painPoint, setPainPoint] = useState("");
  const [hook, setHook] = useState("");
  const [proof, setProof] = useState("");
  const [cta, setCta] = useState("");
  const [budget, setBudget] = useState("0");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<ContentAiOutput | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const product = products.find(item => item.id === productId);
  const brief = useMemo(() => buildManualBrief({ productName: product?.name ?? "", audience, painPoint, hook, proof, cta }), [product, audience, painPoint, hook, proof, cta]);
  const tracking = useMemo(() => createTrackingPlan({ platform, channel, contentKey, variant, campaign }), [platform, channel, contentKey, variant, campaign]);

  const changeProduct = (id: string) => {
    setProductId(id);
    const match = products.find(item => item.id === id);
    if (match) setContentKey(`${safeKey(match.name).slice(0, 18)}001`);
    setSaved(null); setSaveError(null);
  };

  const save = async () => {
    if (!brief.ready || !tracking.complete || !product) return;
    setSaving(true); setSaveError(null);
    const draft: Draft = { id: crypto.randomUUID(), productId, platform, channel: tracking.subId2, contentKey: tracking.subId3, variant: tracking.subId4, campaign: tracking.subId5, audience, painPoint, hook, proof, cta, budget, createdAt: new Date().toISOString() };
    if (databaseEnabled) {
      try {
        const response = await fetch("/api/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          productItemId: productId, productName: product.name, platform, channel: tracking.subId2,
          contentKey: tracking.subId3, variant: tracking.subId4, campaign: tracking.subId5,
          audience, painPoint, hook, proof, cta, budget: Math.max(0, Number(budget) || 0),
        }) });
        const payload = await response.json() as { experimentId?: string; error?: string };
        if (!response.ok || !payload.experimentId) throw new Error(payload.error || "Không thể lưu experiment.");
        setSaved(`db:${payload.experimentId}`);
      } catch (caught) { setSaveError(caught instanceof Error ? caught.message : "Không thể lưu experiment."); }
      finally { setSaving(false); }
      return;
    }
    try {
      const storageKey = "profitos.contentDrafts.v1";
      const previous = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as Draft[];
      localStorage.setItem(storageKey, JSON.stringify([draft, ...previous].slice(0, 100)));
      setSaved(draft.id);
    } catch { setSaveError("Trình duyệt không cho phép lưu cục bộ."); }
    finally { setSaving(false); }
  };

  const generateWithAi = async () => {
    if (!product || !audience.trim() || !painPoint.trim() || !proof.trim()) return;
    setAiLoading(true); setAiError(null);
    try {
      const response = await fetch("/api/ai/content-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productName: product.name, audience, painPoint, evidence: proof, platform }) });
      const payload = await response.json() as { brief?: ContentAiOutput; error?: string };
      if (!response.ok || !payload.brief) throw new Error(payload.error || "AI không trả về brief hợp lệ.");
      setAiResult(payload.brief); setHook(payload.brief.hookOptions[0]); setCta(payload.brief.cta);
    } catch (caught) { setAiError(caught instanceof Error ? caught.message : "Không thể tạo brief AI."); }
    finally { setAiLoading(false); }
  };

  if (!products.length) return <div className="empty-source"><ShieldAlert size={26} /><h3>Chưa có sản phẩm thật</h3><p>Nhập file link sản phẩm Shopee trước khi tạo content test.</p></div>;

  return <div className="content-builder-grid">
    <section className="content-form table-card">
      <div className="calculator-title"><div><p>ONE PRODUCT · ONE CHEAP TEST</p><h2>Brief nội dung có attribution</h2></div><ClipboardCheck size={22} /></div>
      <p className="form-help">Không tự tạo claim sản phẩm. Chỉ dùng thông tin bạn có thể chứng minh bằng hình ảnh, demo hoặc nguồn chính thức.</p>
      <div className="content-fields">
        <label className="full"><span>Sản phẩm thật</span><select value={productId} onChange={event => changeProduct(event.target.value)}>{products.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Nền tảng / Sub_id1</span><select value={platform} onChange={event => setPlatform(event.target.value as "tiktok" | "youtube")}><option value="tiktok">TikTok</option><option value="youtube">YouTube Shorts</option></select></label>
        <label><span>Ngân sách test (VNĐ)</span><input inputMode="numeric" value={budget} onChange={event => setBudget(event.target.value)} /></label>
        <label><span>Kênh / Sub_id2</span><input value={channel} placeholder="vd: nguyenvu" onChange={event => setChannel(event.target.value)} /></label>
        <label><span>Mã content / Sub_id3</span><input value={contentKey} onChange={event => setContentKey(event.target.value)} /></label>
        <label><span>Biến thể / Sub_id4</span><input value={variant} onChange={event => setVariant(event.target.value)} /></label>
        <label><span>Chiến dịch / Sub_id5</span><input value={campaign} placeholder="vd: test082026" onChange={event => setCampaign(event.target.value)} /></label>
        <label className="full"><span>Khách hàng mục tiêu</span><input value={audience} placeholder="Ai đang gặp vấn đề này?" onChange={event => setAudience(event.target.value)} /></label>
        <label className="full"><span>Nỗi đau/vấn đề</span><textarea value={painPoint} placeholder="Vấn đề cụ thể, không phóng đại" onChange={event => setPainPoint(event.target.value)} /></label>
        <label className="full"><span>Hook 3 giây</span><textarea value={hook} placeholder="Lý do người xem phải dừng cuộn" onChange={event => setHook(event.target.value)} /></label>
        <label className="full"><span>Bằng chứng hoặc cảnh demo</span><textarea value={proof} placeholder="Bạn sẽ quay/chứng minh điều gì?" onChange={event => setProof(event.target.value)} /></label>
        <label className="full"><span>CTA</span><input value={cta} placeholder="Kêu gọi hành động rõ ràng" onChange={event => setCta(event.target.value)} /></label>
      </div>
      <div className="tracking-preview"><span>Tracking key</span><code>{tracking.attributionKey}</code><b>{tracking.complete ? "Sẵn sàng" : "Thiếu kênh/chiến dịch"}</b></div>
      <div className="content-actions"><button className="primary-button save-draft" disabled={!brief.ready || !tracking.complete || saving} onClick={() => void save()}>{saving ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Lưu experiment</button><button className="soft-button ai-brief-button" disabled={!aiEnabled || aiLoading || !audience.trim() || !painPoint.trim() || !proof.trim()} onClick={() => void generateWithAi()}>{aiLoading ? <LoaderCircle className="spin" size={15} /> : <Bot size={15} />} AI gợi ý brief</button></div>
      {saved && <span className="draft-saved"><CheckCircle2 size={14} /> {saved.startsWith("db:") ? "Đã lưu vào Supabase Experiment DB" : "Đã lưu cục bộ trên trình duyệt này"}</span>}
      {saveError && <span className="ai-inline-error">{saveError}</span>}
      {aiError && <span className="ai-inline-error">{aiError}</span>}
      {aiResult && <div className="ai-suggestions"><b>Hook thay thế</b>{aiResult.hookOptions.slice(1).map(option => <button type="button" onClick={() => setHook(option)} key={option}>{option}</button>)}{aiResult.claimWarnings.length > 0 && <p>Cảnh báo claim: {aiResult.claimWarnings.join(" · ")}</p>}</div>}
    </section>

    <aside className="brief-preview">
      <div className="brief-product"><span>TEST TARGET</span><h3>{product?.name}</h3><p>{product ? `${money(product.price)} · ${money(product.commissionAmount)}/đơn` : ""}</p></div>
      <div className="scene-list">{brief.scenes.map(scene => <article key={scene.time}><b>{scene.time}</b><div><span>{scene.purpose}</span><p>{scene.direction}</p></div></article>)}</div>
      <div className={`brief-readiness ${brief.ready && tracking.complete ? "ready" : ""}`}><b>{brief.ready && tracking.complete ? "Experiment sẵn sàng" : "Experiment chưa đủ"}</b><p>{brief.ready && tracking.complete ? "Tiếp theo: điền đúng 5 Sub_id trên Shopee, quay nội dung, kiểm tra claim rồi đăng thủ công." : `Còn thiếu brief: ${brief.missing.join(", ") || "không"}; tracking: ${tracking.complete ? "đủ" : "thiếu"}.`}</p></div>
      <div className="ai-unavailable"><ShieldAlert size={15} /><span><b>AI generation: {aiEnabled ? "AVAILABLE" : "chưa cấu hình"}</b><small>{aiEnabled ? "Structured output; vẫn cần bạn kiểm tra claim trước khi đăng." : "Cần OPENAI_API_KEY hoặc AI provider hợp lệ."}</small></span></div>
    </aside>
  </div>;
}
