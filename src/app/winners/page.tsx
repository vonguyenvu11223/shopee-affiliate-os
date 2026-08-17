import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Trophy } from "lucide-react";
import { formatVnd } from "@/lib/format";
import { getSupabaseCapability } from "@/lib/supabase/config";
import { getPerformanceDashboard } from "@/repositories/performance-repository";

export default async function WinnersPage() {
  const databaseEnabled = getSupabaseCapability().database === "AVAILABLE";
  const experiments = databaseEnabled ? await getPerformanceDashboard() : [];
  const winners = experiments.filter(item => item.summary.lineageComplete && item.summary.analysis?.state === "SCALING");

  return <>
    <div className="page-heading"><div><p>WINNERS · VERIFIED PERFORMANCE</p><h1>Winners</h1><h2>Chỉ hiển thị experiment đạt SCALING sau khi đối soát đủ Báo cáo click và chuyển đổi đúng Sub_id.</h2></div><div className="heading-actions"><Link className="soft-button" href="/analytics">Mở phân tích <ArrowUpRight size={15} /></Link></div></div>
    {!databaseEnabled && <div className="manual-notice"><ShieldCheck size={19} /><div><b>MANUAL_REQUIRED · Chưa cấu hình Product DB</b><p>Cấu hình Supabase Auth/Database và chạy migrations trước khi hệ thống có thể lưu, đối soát và xác nhận winner.</p></div><Link href="/settings/shopee">Mở cài đặt</Link></div>}
    {databaseEnabled && !winners.length && <div className="placeholder"><div><Trophy size={28} /></div><p>NO VERIFIED WINNER</p><h1>Chưa có winner đủ bằng chứng</h1><span>{experiments.length ? `Đã có ${experiments.length} experiment nhưng chưa experiment nào vừa đủ lineage vừa đạt ngưỡng SCALING.` : "Chưa có experiment đã lưu. Hãy tạo content test, gắn Sub_id rồi nhập báo cáo chính thức."}</span><Link href="/experiments">Nhập kết quả thử nghiệm <ArrowUpRight size={15} /></Link></div>}
    {winners.length > 0 && <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Experiment</th><th>Sản phẩm</th><th>Tracking key</th><th>Đơn hợp lệ</th><th>Hoa hồng xác nhận</th><th>Lợi nhuận ròng</th><th>ROI</th><th>Confidence</th></tr></thead><tbody>{winners.map(item => {
      const analysis = item.summary.analysis!;
      const totals = item.summary.totals!;
      return <tr key={item.id}><td><b>{item.title}</b><span className="cell-sub">{item.summary.periodCount} kỳ đã đối soát</span></td><td>{item.productName}</td><td><code>{item.trackingKey}</code></td><td>{totals.validOrders}</td><td>{formatVnd(totals.validatedCommission)}</td><td><b>{formatVnd(analysis.netProfit)}</b></td><td>{analysis.roi === null ? "—" : `${analysis.roi.toFixed(2)}x`}</td><td>{analysis.confidence}%</td></tr>;
    })}</tbody></table></div></div>}
  </>;
}
