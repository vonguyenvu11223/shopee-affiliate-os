"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clapperboard, Copy, Sparkles, Wand2 } from "lucide-react";
import { buildVisualPrompt, suggestSubjectEn, type AspectRatio, type PromptTarget, type PromptTone } from "@/lib/content/visual-prompt";

interface ProductOption { id: string; name: string; category?: string }

const TARGET_LABELS: Record<PromptTarget, { label: string; note: string }> = {
  UGC_VIDEO: { label: "UGC video (TopView)", note: "Có người cầm sản phẩm nói với camera" },
  CINEMATIC_VIDEO: { label: "Cinematic (Veo / Sora / Kling)", note: "Không người, sản phẩm là nhân vật chính" },
};

const TONE_LABELS: Record<PromptTone, string> = {
  energetic: "Sôi động", calm: "Nhẹ nhàng", premium: "Cao cấp", playful: "Vui nhộn",
};

export function VisualPromptStudio({ products }: { products: ProductOption[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = products.find(item => item.id === productId);

  const [target, setTarget] = useState<PromptTarget>("UGC_VIDEO");
  const [subjectEn, setSubjectEn] = useState(() => suggestSubjectEn(products[0]?.name ?? "", products[0]?.category));
  const [audienceEn, setAudienceEn] = useState("");
  const [settingEn, setSettingEn] = useState("");
  const [useCaseEn, setUseCaseEn] = useState("");
  const [presenterEn, setPresenterEn] = useState("");
  const [tone, setTone] = useState<PromptTone>("energetic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [durationSeconds, setDurationSeconds] = useState(15);
  const [copied, setCopied] = useState<string | null>(null);

  const result = useMemo(() => buildVisualPrompt({
    target, subjectEn, audienceEn, settingEn, useCaseEn, tone, aspectRatio, durationSeconds, presenterEn,
  }), [target, subjectEn, audienceEn, settingEn, useCaseEn, tone, aspectRatio, durationSeconds, presenterEn]);

  const changeProduct = (id: string) => {
    setProductId(id);
    const match = products.find(item => item.id === id);
    if (match) setSubjectEn(suggestSubjectEn(match.name, match.category));
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1_500);
    } catch { setCopied(null); }
  };

  if (!products.length) return <div className="empty-source"><Wand2 size={26} /><h3>Chưa có sản phẩm thật</h3><p>Nhập file link sản phẩm Shopee trước khi tạo prompt.</p></div>;

  return <div className="content-builder-grid">
    <section className="content-form table-card">
      <div className="calculator-title"><div><p>PROMPT STUDIO · KHÔNG CẦN API</p><h2>Tạo prompt ảnh/video</h2></div><Clapperboard size={22} /></div>
      <p className="form-help">Prompt được ghép bằng luật từ dữ liệu sản phẩm và mô tả của bạn — không gọi AI, không tốn tiền. Viết bằng tiếng Anh vì model tạo video hiểu tốt hơn nhiều.</p>

      <div className="generator-modes">{(Object.keys(TARGET_LABELS) as PromptTarget[]).map(item => <button
        type="button" key={item} className={target === item ? "active" : ""} onClick={() => setTarget(item)}
      >{item === "UGC_VIDEO" ? <Sparkles size={15} /> : <Clapperboard size={15} />} {TARGET_LABELS[item].label}</button>)}</div>
      <p className="capability-note">{TARGET_LABELS[target].note}</p>

      <div className="content-fields">
        <label className="full"><span>Sản phẩm</span><select value={productId} onChange={event => changeProduct(event.target.value)}>{products.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="full"><span>Sản phẩm là gì (tiếng Anh)</span><input value={subjectEn} placeholder="vd: handheld car vacuum cleaner" onChange={event => setSubjectEn(event.target.value)} /></label>
        <label className="full"><span>Khách hàng (tiếng Anh)</span><input value={audienceEn} placeholder="vd: young car owners in Vietnam" onChange={event => setAudienceEn(event.target.value)} /></label>
        <label className="full"><span>Bối cảnh quay (tiếng Anh)</span><input value={settingEn} placeholder="vd: car interior, daytime, natural light" onChange={event => setSettingEn(event.target.value)} /></label>
        <label className="full"><span>Hành động sử dụng (tiếng Anh)</span><input value={useCaseEn} placeholder="vd: vacuuming crumbs from seat gaps" onChange={event => setUseCaseEn(event.target.value)} /></label>
        {target === "UGC_VIDEO" && <label className="full"><span>Người xuất hiện (tiếng Anh)</span><input value={presenterEn} placeholder="vd: Vietnamese woman in her 20s, casual outfit" onChange={event => setPresenterEn(event.target.value)} /></label>}
        <label><span>Tông</span><select value={tone} onChange={event => setTone(event.target.value as PromptTone)}>{(Object.keys(TONE_LABELS) as PromptTone[]).map(item => <option value={item} key={item}>{TONE_LABELS[item]}</option>)}</select></label>
        <label><span>Khung hình</span><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value as AspectRatio)}><option value="9:16">9:16 dọc</option><option value="1:1">1:1 vuông</option><option value="16:9">16:9 ngang</option></select></label>
        <label><span>Thời lượng (giây)</span><input inputMode="numeric" value={durationSeconds} onChange={event => setDurationSeconds(Math.max(5, Math.min(60, Number(event.target.value) || 15)))} /></label>
      </div>

      {result.missing.length > 0 && <p className="capability-note"><AlertTriangle size={13} /> Còn thiếu: {result.missing.join(", ")}.</p>}
      {result.warnings.length > 0 && <div className="claim-preview"><b><AlertTriangle size={15} /> Prompt đang chứa claim không nên có</b><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
    </section>

    <aside className="brief-preview">
      <div className="brief-product"><span>PROMPT · {TARGET_LABELS[target].label.toUpperCase()}</span><h3>{product?.name}</h3><p>{durationSeconds}s · {aspectRatio} · {TONE_LABELS[tone]}</p></div>

      <div className="prompt-output">
        <div className="prompt-block">
          <div className="prompt-block-head"><b>Prompt chính</b><button type="button" onClick={() => void copy("prompt", result.prompt)}>{copied === "prompt" ? <Check size={13} /> : <Copy size={13} />} Copy</button></div>
          <pre>{result.prompt}</pre>
        </div>
        <div className="prompt-block">
          <div className="prompt-block-head"><b>Negative prompt</b><button type="button" onClick={() => void copy("negative", result.negativePrompt)}>{copied === "negative" ? <Check size={13} /> : <Copy size={13} />} Copy</button></div>
          <pre>{result.negativePrompt}</pre>
        </div>
      </div>

      <div className={`brief-readiness ${result.ready ? "ready" : ""}`}>
        <b>{result.ready ? "Prompt sẵn sàng dùng" : "Prompt chưa hoàn chỉnh"}</b>
        <p>{result.ready
          ? "Copy sang công cụ tạo video. Video làm ra vẫn phải qua review gate ở tab AI Video trước khi đăng."
          : "Điền đủ các ô tiếng Anh và bỏ những câu mang tính khẳng định công dụng."}</p>
      </div>
    </aside>
  </div>;
}
