"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, ChevronDown, CircleHelp, LayoutDashboard, Menu, Orbit, PanelLeftClose,
  Rocket, Search, Send, Settings, Sparkles, Video, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

interface NavItem { href: string; label: string; icon: LucideIcon; badge?: string; accent?: boolean }
interface NavGroup { label: string; items: NavItem[] }

/*
 * Chỉ liệt kê những trang đang THẬT SỰ dùng trong luồng hiện tại:
 * tìm sản phẩm → lấy ảnh → ChatGPT sinh prompt + lời thoại → TikTok Symphony →
 * nạp video về → đăng lên mạng xã hội.
 *
 * ⚠️ Các trang bị gỡ khỏi đây (winners, experiments, analytics, jobs,
 * settings/ai, products/discover) VẪN CÒN mã và vẫn mở được bằng URL trực tiếp.
 * Chúng phục vụ luồng đo ROI bằng Báo cáo click/chuyển đổi — chưa chạy nên
 * không nên chiếm chỗ trên thanh bên. Cần dùng lại thì thêm dòng vào đây.
 */
const nav: NavGroup[] = [
  { label: "Vận hành", items: [
    { href: "/", label: "Command Center", icon: LayoutDashboard },
    { href: "/radar", label: "Product Radar", icon: Orbit },
    { href: "/content", label: "Content Studio", icon: Video },
  ] },
  { label: "Hệ thống", items: [
    { href: "/settings/publishing", label: "Đăng tự động", icon: Send },
    { href: "/settings/shopee", label: "Cài đặt", icon: Settings },
  ] },
];

export function AppShell({ children, realData, productCount, authEnabled }: { children: React.ReactNode; realData: boolean; productCount: number; authEnabled: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  return <div className="app-frame">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Rocket size={19} /></div><div><b>ProfitOS</b><span>Shopee Affiliate</span></div><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={20} /></button></div>
      <nav className="side-nav">
        {nav.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badge = item.href === "/radar" && realData ? String(productCount) : item.badge;
          return <Link href={item.href} onClick={() => setOpen(false)} className={`${active ? "active" : ""} ${item.accent ? "accent" : ""}`} key={item.href}><Icon size={18} /><span>{item.label}</span>{badge && <em>{badge}</em>}</Link>;
        })}</div>)}
      </nav>
      <div className="plan-card source-card"><span><Sparkles size={14} /> Nguồn dữ liệu</span><b>{realData ? "Shopee Affiliate CSV" : "Chưa kết nối"}</b><small>{realData ? `${productCount} sản phẩm thật đã nhập` : "Không sử dụng demo data"}</small><Link href="/settings/shopee">Xem trạng thái</Link></div>
      <button className="sidebar-collapse" disabled title="UNAVAILABLE: chưa triển khai trạng thái thu gọn"><PanelLeftClose size={17} /> Thu gọn</button>
    </aside>
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
    <div className="workspace">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={20} /></button>
        <div className="search" title="UNAVAILABLE: tìm kiếm toàn hệ thống chưa được triển khai"><Search size={17} /><input aria-label="Tìm kiếm" placeholder="Tìm trong Product Radar" disabled /><kbd>—</kbd></div>
        <div className="top-actions"><span className={`demo-chip ${realData ? "real-data-chip" : ""}`}>{realData ? "SHOPEE DATA" : "NO DATA"}</span><button aria-label="Trợ giúp chưa khả dụng" disabled title="UNAVAILABLE"><CircleHelp size={19} /></button><button className="notification" aria-label="Thông báo chưa khả dụng" disabled title="UNAVAILABLE"><Bell size={19} /></button>{authEnabled ? <form action="/auth/signout" method="post"><button className="profile" title="Đăng xuất"><span>SA</span><div><b>Affiliate</b><small>Đã đăng nhập</small></div><ChevronDown size={15} /></button></form> : <button className="profile" disabled title="MANUAL_REQUIRED: cấu hình Supabase Auth"><span>SA</span><div><b>Affiliate</b><small>Local mode</small></div><ChevronDown size={15} /></button>}</div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>;
}
