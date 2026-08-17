import { ExternalLink, PackageSearch, Search } from "lucide-react";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";
import { formatVnd } from "@/lib/format";
import { ProductAvatar } from "@/components/product-avatar";
import { ScoreRing } from "@/components/score-ring";
import { TrendPill } from "@/components/status-pill";

export default async function DiscoverPage() {
  const data = await getAffiliateExportData();
  return <><div className="page-heading"><div><p>DISCOVER · SHOPEE EXPORT</p><h1>Sản phẩm đã nhập</h1><h2>{data.products.length} sản phẩm thật từ lần tạo link hàng loạt gần nhất.</h2></div></div>
    <div className="discover-search"><Search size={20} /><input placeholder="Tìm kiếm được thực hiện trong Product Radar..." disabled /><button className="primary-button" disabled><PackageSearch size={16} /> Dữ liệu thật</button></div>
    <div className="filter-chips"><button className="active">Tất cả ({data.products.length})</button><button disabled>Trend: chưa đủ dữ liệu</button><button disabled>ROI: chưa đủ dữ liệu</button></div>
    <div className="product-grid">{data.products.map(product => <article key={product.id}><div className="product-visual" style={{ background: product.color }}><ProductAvatar color={product.color} name={product.name} /><span>SHOPEE EXPORT</span></div><div className="product-card-body"><TrendPill stage={product.trendStage} /><h3>{product.name}</h3><p>{product.shopName} · {formatVnd(product.price)}</p><div className="product-stats"><div><span>Hoa hồng/đơn</span><b>{formatVnd(product.commissionAmount)} · {product.commissionRate}%</b></div><ScoreRing score={null} size={48} /></div>{product.affiliateUrl ? <a className="product-link-button" href={product.affiliateUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Mở affiliate link</a> : <button disabled>Không có link</button>}</div></article>)}</div>
  </>;
}
