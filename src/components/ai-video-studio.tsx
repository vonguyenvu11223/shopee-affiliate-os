"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, FileVideo, LoaderCircle, Lock, ScanSearch, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { detectClaims, summarizeClaimRisk, type DetectedClaim } from "@/lib/content/claim-detector";
import { describeBlocker, evaluateContentReleaseGate, resolveProvenance, type ClaimVerdict, type ContentGenerator, type ContentReviewStatus } from "@/lib/content/video-provenance";
import { uploadMediaFile } from "@/lib/publishing/media-upload";
import { PublishPanel, type ConnectionState } from "@/components/publish-panel";
import type { PublishMediaKind } from "@/lib/publishing/caption-builder";

interface ProductOption { id: string; name: string; productUrl?: string; affiliateUrl?: string }
interface AssetSummary {
  id: string;
  generator: ContentGenerator;
  videoUrl: string | null;
  generatedScript: string | null;
  detectedClaims: DetectedClaim[];
  reviewStatus: ContentReviewStatus;
  createdAt: string;
  costVnd: number;
}

const STATUS_LABELS: Record<ContentReviewStatus, string> = {
  GENERATING: "Đang tạo",
  AI_DRAFT: "Chờ duyệt",
  UNDER_REVIEW: "Đang duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  FAILED: "Tạo thất bại",
};

const VERDICT_LABELS: Record<ClaimVerdict, string> = {
  VERIFIED: "Có bằng chứng",
  REMOVED: "Sẽ cắt bỏ",
  UNVERIFIED: "Chưa xác minh",
};

export function AiVideoStudio({ products, assets, apiEnabled, apiReason, databaseEnabled, connections, verifiedUrlPrefix }: {
  products: ProductOption[];
  assets: AssetSummary[];
  apiEnabled: boolean;
  apiReason: string | null;
  databaseEnabled: boolean;
  connections: ConnectionState[];
  verifiedUrlPrefix: string | null;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [generator, setGenerator] = useState<ContentGenerator>("TOPVIEW_WEB_MANUAL");
  const [videoUrl, setVideoUrl] = useState("");
  const [script, setScript] = useState("");
  const [costVnd, setCostVnd] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<PublishMediaKind>("VIDEO");
  const [uploading, setUploading] = useState(false);

  const [activeAsset, setActiveAsset] = useState<AssetSummary | null>(assets.find(asset => asset.reviewStatus === "AI_DRAFT") ?? null);
  const [verdicts, setVerdicts] = useState<Record<string, ClaimVerdict>>({});
  const [aigcAcknowledged, setAigcAcknowledged] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDone, setReviewDone] = useState<string | null>(null);

  const product = products.find(item => item.id === productId);
  const previewClaims = useMemo(() => (script.trim() ? detectClaims(script) : []), [script]);
  const previewRisk = summarizeClaimRisk(previewClaims);
  const provenance = resolveProvenance(generator);

  const reviewClaims = activeAsset?.detectedClaims ?? [];
  const claimReviews = reviewClaims.map(claim => ({ claim: claim.claim, risk: claim.risk, verdict: verdicts[claim.claim] ?? "UNVERIFIED" as ClaimVerdict }));
  const gate = useMemo(() => evaluateContentReleaseGate({
    provenance: activeAsset ? resolveProvenance(activeAsset.generator) : "AI_GENERATED_UNVERIFIED",
    reviewStatus: "APPROVED",
    generatedScript: activeAsset?.generatedScript ?? null,
    detectedClaimCount: reviewClaims.length,
    claimReviews,
    aigcLabelAcknowledged: aigcAcknowledged,
    reviewNote,
  }), [activeAsset, reviewClaims.length, claimReviews, aigcAcknowledged, reviewNote]);

  const openReview = (asset: AssetSummary) => {
    setActiveAsset(asset);
    setVerdicts({});
    setAigcAcknowledged(false);
    setReviewNote("");
    setReviewError(null);
    setReviewDone(null);
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setIngestError(null);
    try {
      const uploaded = await uploadMediaFile(file);
      setVideoUrl(uploaded.url);
      setMediaKind(uploaded.kind);
    } catch (caught) { setIngestError(caught instanceof Error ? caught.message : "Không thể tải file lên."); }
    finally { setUploading(false); }
  };

  const ingest = async () => {
    if (!product || !videoUrl.trim() || script.trim().length < 10) return;
    setSubmitting(true); setIngestError(null);
    try {
      const response = await fetch("/api/content/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        productItemId: product.id, productName: product.name, generator,
        sourceUrl: product.productUrl || undefined, videoUrl: videoUrl.trim(),
        generatedScript: script.trim(), costVnd: Math.max(0, Number(costVnd) || 0),
      }) });
      const payload = await response.json() as { assetId?: string; detectedClaims?: DetectedClaim[]; error?: string };
      if (!response.ok || !payload.assetId) throw new Error(payload.error || "Không thể lưu video asset.");
      openReview({
        id: payload.assetId, generator, videoUrl: videoUrl.trim(), generatedScript: script.trim(),
        detectedClaims: payload.detectedClaims ?? [], reviewStatus: "AI_DRAFT",
        createdAt: new Date().toISOString(), costVnd: Math.max(0, Number(costVnd) || 0),
      });
      setVideoUrl(""); setScript("");
    } catch (caught) { setIngestError(caught instanceof Error ? caught.message : "Không thể lưu video asset."); }
    finally { setSubmitting(false); }
  };

  const submitReview = async (decision: "APPROVE" | "REJECT") => {
    if (!activeAsset) return;
    if (decision === "APPROVE" && !gate.releasable) return;
    setReviewing(true); setReviewError(null);
    try {
      const response = await fetch(`/api/content/assets/${activeAsset.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        decision, claimReviews, aigcLabelAcknowledged: aigcAcknowledged, reviewNote,
      }) });
      const payload = await response.json() as { reviewStatus?: string; error?: string };
      if (!response.ok || !payload.reviewStatus) throw new Error(payload.error || "Không thể lưu kết quả duyệt.");
      setReviewDone(payload.reviewStatus);
      setActiveAsset({ ...activeAsset, reviewStatus: payload.reviewStatus as ContentReviewStatus });
    } catch (caught) { setReviewError(caught instanceof Error ? caught.message : "Không thể lưu kết quả duyệt."); }
    finally { setReviewing(false); }
  };

  if (!products.length) return <div className="empty-source"><ShieldAlert size={26} /><h3>Chưa có sản phẩm thật</h3><p>Nhập file link sản phẩm Shopee trước khi tạo video AI.</p></div>;

  return <div className="content-builder-grid">
    <section className="content-form table-card">
      <div className="calculator-title"><div><p>AI VIDEO · CHƯA KIỂM CHỨNG</p><h2>Nạp video AI vào review gate</h2></div><FileVideo size={22} /></div>
      <p className="form-help">Video AI sinh từ trang sản phẩm do người bán kiểm soát. Script bên dưới là dữ liệu không tin cậy: bạn phải đọc và xác minh từng claim trước khi nội dung được phép dùng cho experiment.</p>

      <div className="generator-modes">
        <button type="button" className={generator === "TOPVIEW_WEB_MANUAL" ? "active" : ""} onClick={() => setGenerator("TOPVIEW_WEB_MANUAL")}>
          <Upload size={15} /> TopView web (miễn phí)
        </button>
        <button type="button" className={generator === "OTHER_MANUAL" ? "active" : ""} onClick={() => setGenerator("OTHER_MANUAL")}>
          <Sparkles size={15} /> Công cụ khác
        </button>
        <button type="button" className="locked" disabled title={apiReason ?? "TopView API"}>
          <Lock size={15} /> TopView API {apiEnabled ? "" : "· cần gói Pro"}
        </button>
      </div>
      {!apiEnabled && <p className="capability-note"><Lock size={13} /> {apiReason}</p>}

      <div className="content-fields">
        <label className="full"><span>Sản phẩm thật</span><select value={productId} onChange={event => setProductId(event.target.value)}>{products.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="full"><span>Gửi file video hoặc ảnh</span><input type="file" accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" disabled={!databaseEnabled || uploading} onChange={event => void chooseFile(event.target.files?.[0])} /></label>
        <label className="full"><span>Hoặc dán link đã có (https)</span><input value={videoUrl} placeholder="Dán link video xuất từ TopView" onChange={event => { setVideoUrl(event.target.value); setMediaKind(/\.(jpg|jpeg|png|webp)(\?|$)/i.test(event.target.value) ? "PHOTO" : "VIDEO"); }} /></label>
        {uploading && <p className="capability-note full"><LoaderCircle className="spin" size={13} /> Đang tải file lên kho media…</p>}
        <label className="full"><span>Script do AI sinh</span><textarea rows={8} value={script} placeholder="Dán nguyên văn script/caption mà công cụ AI đã tạo" onChange={event => setScript(event.target.value)} /></label>
        <label><span>Chi phí thực (VNĐ)</span><input inputMode="numeric" value={costVnd} onChange={event => setCostVnd(event.target.value)} /></label>
        <label><span>Provenance</span><input value={provenance} readOnly /></label>
      </div>

      {previewClaims.length > 0 && <div className="claim-preview">
        <b><ScanSearch size={15} /> Phát hiện {previewRisk.total} claim cần kiểm tra ({previewRisk.high} rủi ro cao)</b>
        <ul>{previewClaims.slice(0, 5).map(claim => <li key={claim.claim}><em className={claim.risk === "HIGH" ? "risk-high" : "risk-medium"}>{claim.risk}</em> {claim.claim}</li>)}</ul>
      </div>}

      <div className="content-actions">
        <button className="primary-button" disabled={!databaseEnabled || submitting || !videoUrl.trim() || script.trim().length < 10} onClick={() => void ingest()}>
          {submitting ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Nạp vào review gate
        </button>
      </div>
      {!databaseEnabled && <span className="ai-inline-error">Cần cấu hình Supabase để lưu asset và cưỡng chế review gate.</span>}
      {ingestError && <span className="ai-inline-error">{ingestError}</span>}
    </section>

    <aside className="brief-preview">
      {!activeAsset ? <div className="brief-readiness"><b>Chưa chọn asset</b><p>Nạp một video hoặc chọn asset chờ duyệt bên dưới.</p></div> : <>
        <div className="brief-product"><span>ĐANG DUYỆT · {STATUS_LABELS[activeAsset.reviewStatus]}</span><h3>{product?.name ?? "Asset"}</h3>{activeAsset.videoUrl && <p><a href={activeAsset.videoUrl} target="_blank" rel="noreferrer">Mở video để xem lại</a></p>}</div>

        <div className="claim-review-list">
          {reviewClaims.length === 0 && <p className="form-help">Không phát hiện claim rủi ro trong script. Vẫn phải xác nhận nhãn AI trước khi duyệt.</p>}
          {reviewClaims.map(claim => <article key={claim.claim} className={claim.risk === "HIGH" ? "claim-high" : ""}>
            <p>{claim.claim}</p>
            <small>{claim.reasons.join(" · ")}</small>
            <div className="verdict-buttons">{(Object.keys(VERDICT_LABELS) as ClaimVerdict[]).map(verdict => <button
              type="button" key={verdict}
              className={(verdicts[claim.claim] ?? "UNVERIFIED") === verdict ? "active" : ""}
              onClick={() => setVerdicts(previous => ({ ...previous, [claim.claim]: verdict }))}
            >{VERDICT_LABELS[verdict]}</button>)}</div>
          </article>)}
        </div>

        <label className="aigc-ack"><input type="checkbox" checked={aigcAcknowledged} onChange={event => setAigcAcknowledged(event.target.checked)} /> <span>Tôi sẽ gắn nhãn nội dung AI khi đăng lên nền tảng.</span></label>
        <label className="full review-note"><span>Kết luận kiểm tra claim</span><textarea rows={3} value={reviewNote} placeholder="Bạn đã kiểm tra gì, dựa trên nguồn nào?" onChange={event => setReviewNote(event.target.value)} /></label>

        <div className={`brief-readiness ${gate.releasable ? "ready" : ""}`}>
          <b>{gate.releasable ? "Đủ điều kiện duyệt" : "Chưa đủ điều kiện duyệt"}</b>
          {gate.blockers.length > 0 && <ul className="blocker-list">{gate.blockers.map(blocker => <li key={blocker}><AlertTriangle size={13} /> {describeBlocker(blocker)}</li>)}</ul>}
        </div>

        <div className="content-actions">
          <button className="primary-button" disabled={reviewing || !gate.releasable} onClick={() => void submitReview("APPROVE")}>
            {reviewing ? <LoaderCircle className="spin" size={15} /> : <BadgeCheck size={15} />} Duyệt
          </button>
          <button className="soft-button" disabled={reviewing || !reviewNote.trim()} onClick={() => void submitReview("REJECT")}>Từ chối</button>
        </div>
        {reviewDone && <span className="draft-saved"><CheckCircle2 size={14} /> Trạng thái: {STATUS_LABELS[reviewDone as ContentReviewStatus] ?? reviewDone}</span>}
        {reviewError && <span className="ai-inline-error">{reviewError}</span>}

        {activeAsset.reviewStatus === "APPROVED" && <PublishPanel
          assetId={activeAsset.id}
          productName={product?.name ?? "Sản phẩm"}
          affiliateUrl={product?.affiliateUrl ?? null}
          mediaUrl={activeAsset.videoUrl}
          mediaKind={mediaKind}
          reviewStatus={activeAsset.reviewStatus}
          aigcLabelRequired
          aigcLabelAcknowledged={aigcAcknowledged || Boolean(reviewDone)}
          connections={connections}
          verifiedUrlPrefix={verifiedUrlPrefix}
        />}
      </>}

      {assets.length > 0 && <div className="asset-queue">
        <b>Asset gần đây</b>
        {assets.slice(0, 8).map(asset => <button type="button" key={asset.id} className={activeAsset?.id === asset.id ? "active" : ""} onClick={() => openReview(asset)}>
          <span>{STATUS_LABELS[asset.reviewStatus]}</span>
          <small>{asset.detectedClaims.length} claim · {new Date(asset.createdAt).toLocaleDateString("vi-VN")}</small>
        </button>)}
      </div>}
    </aside>
  </div>;
}
