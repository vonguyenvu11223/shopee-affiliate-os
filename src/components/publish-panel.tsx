"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, Send, Youtube } from "lucide-react";
import { applySubIdsToAffiliateUrl, createTrackingPlan } from "@/lib/attribution/tracking";
import { AFFILIATE_PROGRAMS, requiresSubIdTracking, type AffiliateProgramId } from "@/lib/attribution/affiliate-program";
import { buildPublishCaption } from "@/lib/publishing/caption-builder";
import { PLATFORM_LINK_NOTES, PLATFORM_LINK_SUPPORT } from "@/lib/publishing/platform-rules";
import { describePublishBlocker, evaluatePublishGate, type ConnectionStatus } from "@/lib/publishing/publish-gate";
import type { PublishMediaKind, PublishPlatform } from "@/lib/publishing/caption-builder";
import type { ContentReviewStatus } from "@/lib/content/video-provenance";

export interface ConnectionState { platform: PublishPlatform; status: ConnectionStatus; accountName: string | null }

interface PublishPanelProps {
  assetId: string;
  productName: string;
  affiliateUrl: string | null;
  mediaUrl: string | null;
  mediaKind: PublishMediaKind;
  reviewStatus: ContentReviewStatus;
  aigcLabelRequired: boolean;
  aigcLabelAcknowledged: boolean;
  connections: ConnectionState[];
  verifiedUrlPrefix: string | null;
}

const PLATFORM_LABELS: Record<PublishPlatform, string> = { YOUTUBE: "YouTube Shorts", TIKTOK: "TikTok (nháp)" };

export function PublishPanel(props: PublishPanelProps) {
  const [platform, setPlatform] = useState<PublishPlatform>("YOUTUBE");
  const [program, setProgram] = useState<AffiliateProgramId>("SHOPEE");
  const [channel, setChannel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [hook, setHook] = useState("");
  const [cta, setCta] = useState("");
  const [showcaseProductId, setShowcaseProductId] = useState("");
  const [bioLinkConfigured, setBioLinkConfigured] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usesSubId = requiresSubIdTracking(program);

  const tracking = useMemo(() => createTrackingPlan({
    platform: platform === "YOUTUBE" ? "youtube" : "tiktok",
    channel, contentKey: props.productName, variant: "v1", campaign,
  }), [platform, channel, campaign, props.productName]);

  const trackedUrl = usesSubId && props.affiliateUrl ? applySubIdsToAffiliateUrl(props.affiliateUrl, tracking) : null;
  const trackingKey = usesSubId && tracking.complete ? tracking.attributionKey : null;
  const connectionStatus = props.connections.find(item => item.platform === platform)?.status ?? "MISSING";

  const gate = evaluatePublishGate({
    platform, program,
    mediaKind: props.mediaKind,
    reviewStatus: props.reviewStatus,
    mediaUrl: props.mediaUrl,
    affiliateUrl: trackedUrl,
    trackingKey,
    showcaseProductId: showcaseProductId.trim() || null,
    bioLinkConfigured,
    connectionStatus,
    aigcLabelRequired: props.aigcLabelRequired,
    aigcLabelAcknowledged: props.aigcLabelAcknowledged,
    verifiedUrlPrefix: props.verifiedUrlPrefix,
  });

  const caption = buildPublishCaption({
    platform, program, productName: props.productName, hook, cta,
    affiliateUrl: trackedUrl, trackingKey, aiGenerated: props.aigcLabelRequired, bioLinkConfigured,
  });

  const publish = async () => {
    if (!gate.publishable) return;
    setPublishing(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        assetId: props.assetId, platform, program, mediaKind: props.mediaKind,
        productName: props.productName, hook, cta,
        affiliateUrl: trackedUrl, trackingKey,
        showcaseProductId: showcaseProductId.trim() || null, bioLinkConfigured,
      }) });
      const payload = await response.json() as { message?: string; error?: string; blockers?: string[] };
      if (!response.ok) throw new Error(payload.blockers?.join(" · ") || payload.error || "Không thể đăng.");
      setResult(payload.message ?? "Đã gửi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đăng."); }
    finally { setPublishing(false); }
  };

  return <div className="publish-panel">
    <b><Send size={14} /> Đăng tự động</b>

    <div className="publish-platforms">{(["YOUTUBE", "TIKTOK"] as PublishPlatform[]).map(item => {
      const status = props.connections.find(entry => entry.platform === item)?.status ?? "MISSING";
      return <button type="button" key={item} className={platform === item ? "active" : ""} onClick={() => setPlatform(item)}>
        {item === "YOUTUBE" && <Youtube size={14} />} {PLATFORM_LABELS[item]}
        <em>{status === "CONNECTED" ? "đã kết nối" : status === "EXPIRED" ? "hết hạn" : "chưa nối"}</em>
      </button>;
    })}</div>

    <div className="publish-platforms">{(Object.keys(AFFILIATE_PROGRAMS) as AffiliateProgramId[]).map(item => <button
      type="button" key={item} className={program === item ? "active" : ""} onClick={() => setProgram(item)}
    >{AFFILIATE_PROGRAMS[item].label}<em>{AFFILIATE_PROGRAMS[item].attributionMode === "SUB_ID" ? "Sub_id" : "gắn trong video"}</em></button>)}</div>

    <p className="capability-note">{PLATFORM_LINK_NOTES[PLATFORM_LINK_SUPPORT[platform]]}</p>

    <div className="publish-fields">
      {usesSubId ? <>
        <label><span>Kênh / Sub_id2</span><input value={channel} placeholder="vd: nguyenvu" onChange={event => setChannel(event.target.value)} /></label>
        <label><span>Chiến dịch / Sub_id5</span><input value={campaign} placeholder="vd: test082026" onChange={event => setCampaign(event.target.value)} /></label>
      </> : <label className="full"><span>Mã sản phẩm TikTok Shop gắn vào video</span><input value={showcaseProductId} placeholder="Product ID trong Creator Center" onChange={event => setShowcaseProductId(event.target.value)} /></label>}
      <label className="full"><span>Tiêu đề / hook</span><input value={hook} placeholder="Câu mở đầu hiển thị làm tiêu đề" onChange={event => setHook(event.target.value)} /></label>
      <label className="full"><span>CTA</span><input value={cta} placeholder="Kêu gọi hành động trong mô tả" onChange={event => setCta(event.target.value)} /></label>
    </div>

    {usesSubId && platform === "TIKTOK" && <label className="aigc-ack">
      <input type="checkbox" checked={bioLinkConfigured} onChange={event => setBioLinkConfigured(event.target.checked)} />
      <span>Tôi đã đặt link affiliate này vào ô Website trong hồ sơ TikTok.</span>
    </label>}

    {trackedUrl && <p className="tracked-url">Link sẽ dùng: <code>{trackedUrl}</code></p>}
    {caption.truncated.length > 0 && <p className="capability-note"><AlertTriangle size={13} /> Bị cắt bớt do vượt giới hạn: {caption.truncated.join(", ")}.</p>}

    {gate.blockers.length > 0 && <ul className="blocker-list">{gate.blockers.map(blocker => <li key={blocker}><AlertTriangle size={13} /> {describePublishBlocker(blocker)}</li>)}</ul>}

    <button className="primary-button" disabled={publishing || !gate.publishable} onClick={() => void publish()}>
      {publishing ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
      {gate.mode === "DIRECT_PUBLIC" ? "Đăng công khai" : "Đẩy vào nháp"}
    </button>
    {result && <span className="draft-saved">{result}</span>}
    {error && <span className="ai-inline-error">{error}</span>}
  </div>;
}
