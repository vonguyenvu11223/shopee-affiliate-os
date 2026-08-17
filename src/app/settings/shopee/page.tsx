import { AlertTriangle, Check, Database, ExternalLink, Link2, RefreshCw, ShieldCheck, Store } from "lucide-react";
import { ShopeeImportForm } from "@/components/shopee-import-form";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";

export default async function ShopeeSettingsPage() {
  const data = await getAffiliateExportData();
  const updated = data.importedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(new Date(data.importedAt)) : "Chưa có";
  return <><div className="page-heading"><div><p>SETTINGS / INTEGRATIONS</p><h1>Kết nối Shopee</h1><h2>Nhập dữ liệu chính thức và theo dõi mức độ sẵn sàng của hệ thống.</h2></div></div>
    <ShopeeImportForm />
    <section className="integration-card"><div className="integration-head"><div className="shopee-logo">S</div><div><h3>Shopee Affiliate Export</h3><p>Official CSV · snapshot history</p></div><span className={data.isReal ? "status-connected" : "status-unavailable"}><i /> {data.isReal ? "ĐÃ KẾT NỐI" : "CHƯA CÓ DỮ LIỆU"}</span></div>
      {data.isReal ? <div className={data.freshness.status === "STALE" ? "integration-alert" : "integration-success"}>{data.freshness.status === "STALE" ? <AlertTriangle size={19} /> : <Check size={19} />}<div><b>Đã đọc {data.products.length} sản phẩm thật</b><p>{data.snapshotCount} snapshot · cập nhật {updated} · {data.productsWithHistory} sản phẩm có lịch sử. {data.freshness.status === "FRESH" ? "Nhập lại sau 24 giờ." : "Đã đến lúc xuất và nhập snapshot mới."}</p></div></div> : <div className="integration-alert"><AlertTriangle size={19} /><div><b>Chưa tìm thấy Shopee CSV</b><p>Dùng form bên trên để nhập file “Lấy link hàng loạt”.</p></div></div>}
      <div className="permission-grid"><div><Store size={18} /><span>Dữ liệu sản phẩm</span><b className="permission-ok">{data.isReal ? "AVAILABLE" : "MANUAL_REQUIRED"}</b></div><div><Link2 size={18} /><span>Affiliate link</span><b className="permission-ok">{data.isReal ? "AVAILABLE" : "MANUAL_REQUIRED"}</b></div><div><RefreshCw size={18} /><span>Tự động đồng bộ</span><b>REQUIRES_PERMISSION</b></div><div><ShieldCheck size={18} /><span>Open API</span><b>REQUIRES_PERMISSION</b></div></div>
      <div className="integration-actions"><span className="source-file"><Database size={15} /> {data.sourceFile ?? "Chưa có file"}</span><a href="https://affiliate.shopee.vn/offer/product_offer" target="_blank" rel="noreferrer">Mở Shopee Affiliate <ExternalLink size={14} /></a></div>
    </section>
    <section className="integration-card cookie-policy-card">
      <div className="integration-head"><div className="shopee-logo"><ShieldCheck size={22} /></div><div><h3>Đăng nhập bằng cookie</h3><p>Session cookie · internal endpoint automation</p></div><span className="status-unavailable"><i /> UNAVAILABLE</span></div>
      <div className="integration-alert"><AlertTriangle size={19} /><div><b>ProfitOS không nhận hoặc lưu cookie đăng nhập Shopee</b><p>Cookie phiên có thể cấp quyền truy cập tài khoản như chính trình duyệt của bạn. Tự động gọi endpoint nội bộ có rủi ro lộ phiên, khóa tài khoản và vượt phạm vi quyền API.</p></div></div>
      <div className="permission-grid"><div><Check size={17} /><span>Xuất link hàng loạt chính thức</span><b className="permission-ok">SUPPORTED</b></div><div><Check size={17} /><span>Báo cáo Click/Conversion CSV</span><b className="permission-ok">SUPPORTED</b></div><div><ShieldCheck size={17} /><span>Sub_id1–5 attribution</span><b className="permission-ok">SUPPORTED</b></div><div><AlertTriangle size={17} /><span>Cookie/session replay</span><b>BLOCKED</b></div></div>
    </section>
    <section className="security-note"><ShieldCheck size={21} /><div><h3>Dữ liệu được bảo vệ</h3><p>CSV chứa affiliate link riêng, được đọc server-side và không được commit vào Git.</p></div><span><Check size={15} /> Server-only</span></section>
  </>;
}
