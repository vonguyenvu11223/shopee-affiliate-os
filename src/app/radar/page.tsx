import { Database, Download, Link2, Radio, Store } from "lucide-react";
import { RadarTable } from "@/components/radar-table";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";

export default async function RadarPage() {
  const data = await getAffiliateExportData();
  const shops = new Set(data.products.map(product => product.shopName).filter(Boolean)).size;
  const maximumRate = Math.max(0, ...data.products.map(product => product.commissionRate));
  const updated = data.importedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.importedAt)) : "Chưa có";
  const freshnessLabel = data.freshness.status === "FRESH" ? "Dữ liệu mới" : data.freshness.status === "DUE" ? "Đến hạn nhập snapshot" : data.freshness.status === "STALE" ? "Dữ liệu đã cũ" : "Chưa có dữ liệu";
  return <>
    <div className="page-heading radar-heading"><div><p>PRODUCT INTELLIGENCE · OFFICIAL EXPORT</p><h1>Product Radar</h1><h2>Metric thiếu bằng chứng được giữ ở trạng thái chưa khả dụng, không nội suy bằng dữ liệu giả.</h2></div><div className="heading-actions"><button className="soft-button" disabled><Download size={16} /> Xuất dữ liệu</button></div></div>
    <div className={`radar-status freshness-${data.freshness.status.toLowerCase()}`}><span><i /> {freshnessLabel}</span><p>{data.products.length} sản phẩm · cập nhật {updated}{data.freshness.ageHours !== null ? ` · ${data.freshness.ageHours} giờ trước` : ""}</p><button disabled title="Chỉ số trạng thái, không phải thao tác"><Database size={14} /> {data.snapshotCount} SNAPSHOT</button></div>
    <section className="radar-kpis">
      <article><div className="kpi-icon blue"><Radio size={18} /></div><div><span>Sản phẩm đã nhập</span><b>{data.products.length}</b></div><small>Dữ liệu thật</small></article>
      <article><div className="kpi-icon green"><Store size={18} /></div><div><span>Cửa hàng</span><b>{shops}</b></div><small>Official export</small></article>
      <article><div className="kpi-icon orange"><Link2 size={18} /></div><div><span>Affiliate links</span><b>{data.products.filter(product => product.affiliateUrl).length}</b></div><small>Đã tạo</small></article>
      <article><div className="kpi-icon purple"><Database size={18} /></div><div><span>Hoa hồng cao nhất</span><b>{maximumRate}%</b></div><small>Không phải ROI</small></article>
      <article><div className="kpi-icon red"><Database size={18} /></div><div><span>Snapshot lịch sử</span><b>{data.snapshotCount}</b></div><small>{data.freshness.status === "STALE" ? "Phải nhập mới trước khi dùng trend" : data.snapshotCount < 3 ? `Cần thêm ${3 - data.snapshotCount}` : "Đủ nền tảng trend"}</small></article>
    </section>
    <RadarTable products={data.products} />
  </>;
}
