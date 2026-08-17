"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { createTrackingPlan, type AffiliatePlatform } from "@/lib/attribution/tracking";

export function AttributionBuilder() {
  const [platform, setPlatform] = useState<AffiliatePlatform>("tiktok");
  const [channel, setChannel] = useState("");
  const [contentKey, setContentKey] = useState("");
  const [variant, setVariant] = useState("v1");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const plan = useMemo(() => createTrackingPlan({ platform, channel, contentKey, variant, campaign }), [platform, channel, contentKey, variant, campaign]);
  const rows = [
    ["Sub_id1", plan.subId1, "Nền tảng"], ["Sub_id2", plan.subId2, "Kênh/tài khoản"],
    ["Sub_id3", plan.subId3, "Mã video/content"], ["Sub_id4", plan.subId4, "Biến thể creative"],
    ["Sub_id5", plan.subId5, "Chiến dịch"],
  ];
  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1_500);
  };

  return <section className="attribution-card table-card">
    <div className="calculator-title"><div><p>ATTRIBUTION FOUNDATION</p><h2>Tạo bộ Sub_id trước khi lấy link</h2></div><Link2 size={22} /></div>
    <p className="form-help">Điền bộ mã này vào đúng 5 ô Sub_id trên Shopee. Mỗi video phải có Sub_id3 riêng; nếu bỏ trống, hệ thống không thể biết video nào tạo ra đơn.</p>
    <div className="tracking-inputs">
      <label><span>Nền tảng</span><select value={platform} onChange={event => setPlatform(event.target.value as AffiliatePlatform)}><option value="tiktok">TikTok</option><option value="youtube">YouTube</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="other">Khác</option></select></label>
      <label><span>Kênh/tài khoản</span><input value={channel} placeholder="vd: nguyenvu" onChange={event => setChannel(event.target.value)} /></label>
      <label><span>Mã video/content</span><input value={contentKey} placeholder="vd: mayhutbui001" onChange={event => setContentKey(event.target.value)} /></label>
      <label><span>Biến thể</span><input value={variant} placeholder="v1" onChange={event => setVariant(event.target.value)} /></label>
      <label><span>Chiến dịch</span><input value={campaign} placeholder="vd: test082026" onChange={event => setCampaign(event.target.value)} /></label>
    </div>
    <div className="tracking-output">
      {rows.map(([label, value, description]) => <div key={label}><span><b>{label}</b><small>{description}</small></span><code>{value}</code><button type="button" aria-label={`Sao chép ${label}`} onClick={() => copy(label, value)}>{copied === label ? <Check size={15} /> : <Copy size={15} />}</button></div>)}
    </div>
    <div className={`tracking-status ${plan.complete ? "ready" : ""}`}><span>Attribution key</span><code>{plan.attributionKey}</code><b>{plan.complete ? "Sẵn sàng tạo link" : "Cần nhập đủ kênh, mã content và chiến dịch"}</b></div>
  </section>;
}
