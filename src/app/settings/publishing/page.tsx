import Link from "next/link";
import { CheckCircle2, Link2, ShieldAlert, Youtube } from "lucide-react";
import { getYouTubeCapability } from "@/providers/publishing/youtube-publishing";
import { getTikTokCapability, getTikTokVerifiedUrlPrefix } from "@/providers/publishing/tiktok-publishing";
import { listConnectionStatuses } from "@/repositories/platform-connection-repository";
import { listPublishAttempts } from "@/repositories/publish-repository";
import { getSupabaseAdminKey } from "@/lib/supabase/config";

const RESULT_MESSAGES: Record<string, string> = {
  connected: "Đã kết nối thành công.",
  denied: "Bạn đã từ chối cấp quyền.",
  state_mismatch: "Phiên kết nối không khớp; thử lại từ đầu.",
  failed: "Kết nối thất bại.",
  unsupported: "Nền tảng chưa được hỗ trợ.",
};

export default async function PublishingSettingsPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams;
  const [connections, attempts] = await Promise.all([listConnectionStatuses(), listPublishAttempts(10)]);
  const youtube = getYouTubeCapability();
  const tiktok = getTikTokCapability();
  const secretConfigured = Boolean(getSupabaseAdminKey());
  const statusOf = (platform: string) => connections.find(item => item.platform === platform)?.status ?? "MISSING";

  const platforms = [
    { key: "YOUTUBE", label: "YouTube Shorts", note: "Đăng công khai trực tiếp. API miễn phí, khoảng 100 video/ngày.", capability: youtube, icon: <Youtube size={19} /> },
    { key: "TIKTOK", label: "TikTok", note: "Chỉ đẩy vào hộp nháp; bạn mở app bấm đăng. Đăng thẳng công khai cần qua audit của TikTok.", capability: tiktok, icon: <Link2 size={19} /> },
  ];

  return <>
    <div className="page-heading"><div><p>PUBLISHING · KẾT NỐI NỀN TẢNG</p><h1>Đăng tự động</h1><h2>Chỉ nội dung đã qua review gate và có link gắn Sub_id mới được đăng.</h2></div></div>

    {result && <div className="manual-notice"><CheckCircle2 size={18} /><div><b>{RESULT_MESSAGES[result] ?? result}</b></div></div>}
    {!secretConfigured && <div className="manual-notice"><ShieldAlert size={18} /><div><b>Chưa cấu hình SUPABASE_SECRET_KEY</b><p>Token OAuth được lưu ở bảng chỉ service-role đọc được. Thiếu key này thì không kết nối được nền tảng nào.</p></div></div>}

    <section className="kpi-grid">{platforms.map(platform => {
      const status = statusOf(platform.key);
      const ready = platform.capability.capability === "AVAILABLE" && secretConfigured;
      return <article key={platform.key}>
        <div className="kpi-icon blue">{platform.icon}</div>
        <span>{platform.label}</span>
        <b>{status === "CONNECTED" ? "Đã kết nối" : status === "EXPIRED" ? "Hết hạn" : "Chưa kết nối"}</b>
        <small>{platform.capability.reason ?? platform.note}</small>
        {ready
          ? <Link className="product-link-button" href={`/api/connect/${platform.key.toLowerCase()}`}>{status === "CONNECTED" ? "Kết nối lại" : "Kết nối"}</Link>
          : <button className="product-link-button" disabled>Chưa cấu hình</button>}
      </article>;
    })}</section>

    {getTikTokVerifiedUrlPrefix() === null && <p className="capability-note"><ShieldAlert size={13} /> Chưa có TIKTOK_VERIFIED_URL_PREFIX nên không đăng được bài ảnh lên TikTok. TikTok chỉ nhận ảnh từ domain bạn đã xác minh trong TikTok Developer Portal.</p>}

    <section>
      <div className="section-heading"><div><h3>Lần đăng gần đây</h3><p>Mỗi lần đăng đều ghi lại mã Sub_id để đối chiếu với báo cáo Shopee</p></div></div>
      {attempts.length === 0
        ? <div className="empty-source"><ShieldAlert size={26} /><h3>Chưa có lần đăng nào</h3><p>Duyệt một nội dung trong Content Studio rồi đăng từ đó.</p></div>
        : <div className="table-card"><table className="data-table"><thead><tr><th>Thời điểm</th><th>Nền tảng</th><th>Kiểu</th><th>Trạng thái</th><th>Mã theo dõi</th></tr></thead><tbody>
            {attempts.map(attempt => <tr key={String(attempt.id)}>
              <td>{new Date(String(attempt.created_at)).toLocaleString("vi-VN")}</td>
              <td>{String(attempt.platform)}</td>
              <td>{attempt.mode === "DIRECT_PUBLIC" ? "Công khai" : "Nháp"}</td>
              <td>{String(attempt.status)}{attempt.failure_reason ? ` · ${String(attempt.failure_reason)}` : ""}</td>
              <td><code>{String(attempt.tracking_key)}</code></td>
            </tr>)}
          </tbody></table></div>}
    </section>
  </>;
}
