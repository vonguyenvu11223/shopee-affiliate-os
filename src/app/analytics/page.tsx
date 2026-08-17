import Link from "next/link";
import { Activity, BadgeDollarSign, FileInput, MousePointerClick, ShieldCheck, ShoppingBag } from "lucide-react";
import { formatVnd } from "@/lib/format";
import { getSupabaseCapability } from "@/lib/supabase/config";
import { getPerformanceDashboard } from "@/repositories/performance-repository";

const stateLabels = { TESTING: "Đang test", VALIDATED: "Đã xác thực", SCALING: "Đủ điều kiện scale", DECLINING: "Đang suy giảm", KILLED: "Đã dừng" } as const;

export default async function AnalyticsPage() {
  const databaseEnabled = getSupabaseCapability().database === "AVAILABLE";
  const experiments = databaseEnabled ? await getPerformanceDashboard() : [];
  const verified = experiments.filter(item => item.summary.lineageComplete && item.summary.analysis && item.summary.totals);
  const totalClicks = verified.reduce((sum, item) => sum + (item.summary.totals?.clicks ?? 0), 0);
  const totalValidOrders = verified.reduce((sum, item) => sum + (item.summary.totals?.validOrders ?? 0), 0);
  const totalCommission = verified.reduce((sum, item) => sum + (item.summary.totals?.validatedCommission ?? 0), 0);
  const totalNetProfit = verified.reduce((sum, item) => sum + (item.summary.analysis?.netProfit ?? 0), 0);

  return <>
    <div className="page-heading"><div><p>ANALYTICS · ATTRIBUTED ONLY</p><h1>Phân tích hiệu suất</h1><h2>Chỉ cộng các kỳ có đủ Báo cáo click và chuyển đổi chính thức cùng tracking key.</h2></div><div className="heading-actions"><Link className="primary-button" href="/experiments"><FileInput size={15} /> Nhập báo cáo</Link></div></div>
    {!databaseEnabled && <div className="manual-notice"><ShieldCheck size={19} /><div><b>MANUAL_REQUIRED · Chưa cấu hình Supabase</b><p>Analytics production cần Auth, Database và migrations để giữ lineage theo từng tài khoản.</p></div><Link href="/settings/shopee">Mở cài đặt</Link></div>}
    <section className="kpi-grid real-kpis">
      <article><div className="kpi-icon green"><Activity size={19} /></div><span>Experiment đã đối soát</span><b>{databaseEnabled ? verified.length : "—"}</b><small>{databaseEnabled ? `${experiments.length} experiment đã lưu` : "Chưa kết nối Database"}</small></article>
      <article><div className="kpi-icon blue"><MousePointerClick size={19} /></div><span>Clicks có attribution</span><b>{databaseEnabled ? totalClicks.toLocaleString("vi-VN") : "—"}</b><small>{databaseEnabled ? "Không gồm kỳ thiếu lineage" : "Chưa khả dụng"}</small></article>
      <article><div className="kpi-icon orange"><ShoppingBag size={19} /></div><span>Đơn hợp lệ</span><b>{databaseEnabled ? totalValidOrders.toLocaleString("vi-VN") : "—"}</b><small>{databaseEnabled ? "Đã loại đơn hủy/hoàn" : "Chưa khả dụng"}</small></article>
      <article><div className="kpi-icon purple"><BadgeDollarSign size={19} /></div><span>Lợi nhuận ròng</span><b>{databaseEnabled ? formatVnd(totalNetProfit) : "—"}</b><small>{databaseEnabled ? `Hoa hồng xác nhận ${formatVnd(totalCommission)}` : "Chưa khả dụng"}</small></article>
    </section>
    {databaseEnabled && !experiments.length && <div className="placeholder"><div><Activity size={28} /></div><p>NO EXPERIMENT DATA</p><h1>Chưa có dữ liệu phân tích</h1><span>Tạo một content test có Sub_id, sau đó nhập Báo cáo click và chuyển đổi trong cùng khoảng ngày.</span><Link href="/content">Tạo content test</Link></div>}
    {experiments.length > 0 && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Experiment</th><th>Sản phẩm</th><th>Lineage</th><th>Trạng thái tính lại</th><th>Clicks</th><th>Đơn hợp lệ</th><th>Lợi nhuận</th><th>ROI</th></tr></thead><tbody>{experiments.map(item => {
      const analysis = item.summary.analysis;
      const totals = item.summary.totals;
      const lineageLabel = !item.summary.periodCount ? "Chưa có kỳ dữ liệu" : item.summary.lineageComplete ? "Đủ CLICK + CONVERSION" : `Thiếu lineage ở ${item.summary.missingLineagePeriods} kỳ`;
      return <tr key={item.id}><td><b>{item.title}</b><span className="cell-sub"><code>{item.trackingKey ?? "Chưa có tracking key"}</code></span></td><td>{item.productName}</td><td><span className={item.summary.lineageComplete ? "positive" : "unavailable"}>{lineageLabel}</span></td><td>{analysis ? stateLabels[analysis.state] : "Không kết luận"}</td><td>{totals?.clicks.toLocaleString("vi-VN") ?? "—"}</td><td>{totals?.validOrders.toLocaleString("vi-VN") ?? "—"}</td><td>{analysis ? formatVnd(analysis.netProfit) : "—"}</td><td>{analysis?.roi === null || analysis?.roi === undefined ? "—" : `${analysis.roi.toFixed(2)}x`}</td></tr>;
    })}</tbody></table></div></div>}
  </>;
}
