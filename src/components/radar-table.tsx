"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { compactNumber, formatVnd } from "@/lib/format";
import type { ProductOpportunity } from "@/lib/types";
import { ProductAvatar } from "@/components/product-avatar";
import { ScoreRing } from "@/components/score-ring";
import { DecisionPill, TrendPill } from "@/components/status-pill";

export function RadarTable({ products: sourceProducts, compact = false }: { products: ProductOpportunity[]; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("ALL");
  const products = useMemo(() => sourceProducts.filter(product =>
    product.name.toLowerCase().includes(query.toLowerCase()) && (stage === "ALL" || product.trendStage === stage),
  ), [query, sourceProducts, stage]);

  return <div className="table-card">
    {!compact && <div className="table-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong radar..." /></div><select value={stage} onChange={event => setStage(event.target.value)} aria-label="Lọc giai đoạn"><option value="ALL">Mọi giai đoạn</option><option value="BREAKOUT">Breakout</option><option value="EARLY_RISING">Early rising</option><option value="TRENDING">Trending</option><option value="DECLINING">Declining</option></select><button className="soft-button" disabled title="UNAVAILABLE: dùng ô tìm kiếm và bộ lọc giai đoạn hiện có"><SlidersHorizontal size={16} /> Bộ lọc nâng cao</button><button className="soft-button" disabled title="UNAVAILABLE"><ArrowDownUp size={16} /> Sắp xếp</button></div>}
    <div className="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Giai đoạn</th><th>Tăng trưởng 24h</th><th>Hoa hồng</th><th>Lợi nhuận dự kiến</th><th>Điểm tổng</th><th>Hành động</th><th /></tr></thead><tbody>
      {products.slice(0, compact ? 4 : products.length).map(product => <tr key={product.id}>
        <td><div className="product-cell"><ProductAvatar color={product.color} name={product.name} /><div><b>{product.name}</b><span>{product.category} · {formatVnd(product.price)}</span></div></div></td>
        <td><TrendPill stage={product.trendStage} /></td>
        <td>{product.growth24h === null ? <span className="unavailable">Chưa có snapshot</span> : <div className={product.growth24h >= 0 ? "positive" : "negative"}><b>{product.growth24h > 0 ? "+" : ""}{product.growth24h}%</b><span>{product.sold === null ? "—" : `${compactNumber(product.sold)} đã bán`}</span></div>}</td>
        <td><b>{product.commissionRate}%</b><span className="cell-sub">{formatVnd(product.commissionAmount)}/đơn</span></td>
        <td>{product.expectedProfit === null || product.expectedRoi === null ? <span className="unavailable">Chưa đủ dữ liệu</span> : <><b>{formatVnd(product.expectedProfit)}</b><span className="cell-sub">ROI {product.expectedRoi.toFixed(1)}x · baseline thật · {product.valueConfidence ?? 0}%</span>{product.expectedProfitLow !== null && product.expectedProfitHigh !== null && <span className="cell-sub">Khoảng {formatVnd(product.expectedProfitLow ?? 0)} – {formatVnd(product.expectedProfitHigh ?? 0)}</span>}</>}</td>
        <td><ScoreRing score={product.masterScore} /></td>
        <td><DecisionPill decision={product.recommendation} /></td>
        <td>{product.affiliateUrl ? <a className="icon-button" href={product.affiliateUrl} target="_blank" rel="noreferrer" aria-label={`Mở link ${product.name}`}><ChevronRight size={17} /></a> : <button className="icon-button" disabled title="MANUAL_REQUIRED: tạo affiliate link trên Shopee" aria-label={`Chưa có link ${product.name}`}><ChevronRight size={17} /></button>}</td>
      </tr>)}
    </tbody></table></div>
    {!products.length && <div className="empty-state">Không tìm thấy sản phẩm phù hợp.</div>}
  </div>;
}
