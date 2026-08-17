import Link from "next/link";
import { ArrowUpRight, CircleDollarSign, Database, Link2, RefreshCw, Store, TrendingUp } from "lucide-react";
import { RadarTable } from "@/components/radar-table";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";

export default async function CommandCenterPage() {
  const data = await getAffiliateExportData();
  const candidate = data.products
    .filter(product => product.recommendation === "TEST_NOW")
    .sort((left, right) => (right.expectedProfit ?? Number.NEGATIVE_INFINITY) - (left.expectedProfit ?? Number.NEGATIVE_INFINITY))[0];
  const shops = new Set(data.products.map(product => product.shopName).filter(Boolean)).size;
  const links = data.products.filter(product => product.affiliateUrl).length;
  const averageCommission = data.products.length ? data.products.reduce((sum, product) => sum + product.commissionRate, 0) / data.products.length : 0;
  const snapshotInstruction = data.freshness.status === "STALE" ? "Snapshot mới nhất đã quá 72 giờ; phải nhập lại trước khi dùng trend." : data.freshness.status === "DUE" ? "Snapshot đã quá 24 giờ; nên nhập bản xuất mới ngay." : "Nhập một bản xuất mới mỗi 24 giờ để xây lịch sử trend.";
  const money = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${Math.round(value).toLocaleString("vi-VN")} đ`;
  const heroTitle = candidate ? `Ứng viên nên test: ${candidate.name}` : "Chưa thể đề xuất sản phẩm nên test một cách đáng tin cậy";
  const heroDescription = candidate
    ? `${candidate.recommendationReason} Đây là ứng viên mở một thử nghiệm nhỏ dựa trên baseline thật, chưa phải winner và chưa phải quyết định scale.`
    : `Đã có ${data.products.length} sản phẩm thật và ${data.snapshotCount} snapshot. Cần tối thiểu 3 snapshot cùng sản phẩm và Báo cáo click/chuyển đổi để tính trend, ROI và quyết định Test/Scale/Kill. ${snapshotInstruction}`;

  return <>
    <div className="page-heading"><div><p>SHOPEE AFFILIATE · DỮ LIỆU THẬT</p><h1>Command Center</h1><h2>Chỉ đưa ra quyết định khi có đủ bằng chứng từ sản phẩm, lịch sử và chuyển đổi.</h2></div><div className="heading-actions"><Link className="soft-button" href="/settings/shopee"><Database size={16} /> Nhập dữ liệu</Link><Link className="primary-button" href="/radar"><RefreshCw size={16} /> Mở Radar</Link></div></div>

    <section className="hero-decision real-data-hero readiness-hero">
      <div className="hero-copy"><div className="hero-label"><Database size={15} /> {candidate ? "EVIDENCE-GATED TEST" : "DATA READINESS"}</div><h3>{heroTitle}</h3><p>{heroDescription}</p><div className="hero-actions">{candidate ? <Link className="dark-button" href="/content">Mở thử nghiệm nhỏ <ArrowUpRight size={16} /></Link> : <Link className="dark-button" href="/settings/shopee"><Database size={16} /> Nhập snapshot mới</Link>}<Link className="ghost-button" href="/radar">Xem dữ liệu hiện có <ArrowUpRight size={16} /></Link></div></div>
      <div className="hero-metrics real-metrics"><div><span>{candidate ? "Expected net profit" : "Product data"}</span><b>{candidate ? money(candidate.expectedProfit) : data.freshness.status === "STALE" ? "Đã cũ" : data.products.length ? "Sẵn sàng" : "Thiếu"}</b><small>{candidate ? `Khoảng ${money(candidate.expectedProfitLow)}–${money(candidate.expectedProfitHigh)}` : `${data.products.length} sản phẩm`}</small></div><div><span>{candidate ? "Expected ROI" : "Trend history"}</span><b>{candidate?.expectedRoi !== null && candidate?.expectedRoi !== undefined ? `${(candidate.expectedRoi * 100).toFixed(0)}%` : `${data.snapshotCount}/3`}</b><small>{candidate ? `Break-even khoảng ${candidate.breakEvenViews?.toLocaleString("vi-VN") ?? "—"} views` : `${data.productsWithHistory} sản phẩm có lịch sử`}</small></div><div><span>Profit baseline</span><b>{candidate ? `${candidate.valueConfidence ?? 0}%` : "—"}</b><small>{candidate ? `Scoring ${candidate.scoringVersion}` : "Chưa đủ báo cáo click/đơn đã đối soát"}</small></div></div>
    </section>

    <section className="kpi-grid real-kpis">
      <article><div className="kpi-icon green"><Database size={19} /></div><span>Sản phẩm thật</span><b>{data.products.length}</b><small>Nguồn Shopee Affiliate CSV</small></article>
      <article><div className="kpi-icon orange"><Store size={19} /></div><span>Cửa hàng</span><b>{shops}</b><small>Trong lần nhập hiện tại</small></article>
      <article><div className="kpi-icon blue"><Link2 size={19} /></div><span>Affiliate link hợp lệ</span><b>{links}</b><small>{links}/{data.products.length} sản phẩm có link</small></article>
      <article><div className="kpi-icon purple"><CircleDollarSign size={19} /></div><span>Hoa hồng trung bình</span><b>{averageCommission.toFixed(1)}%</b><small><TrendingUp size={14} /> Không phải ROI</small></article>
    </section>

    <section><div className="section-heading"><div><h3>Sản phẩm vừa nhập</h3><p>Chưa xếp hạng winner khi thiếu trend và conversion</p></div><Link href="/radar">Mở Product Radar <ArrowUpRight size={15} /></Link></div><RadarTable products={data.products} compact /></section>
  </>;
}
