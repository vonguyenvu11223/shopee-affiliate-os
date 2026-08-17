import { Package } from "lucide-react";

export function ProductAvatar({ color, name }: { color: string; name: string }) {
  return <div className="product-avatar" style={{ background: color }} aria-label={name}><div className="product-shape"><Package size={22} strokeWidth={1.5} /></div></div>;
}
