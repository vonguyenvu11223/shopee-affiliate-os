"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, Upload } from "lucide-react";

export function ShopeeImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ loading: boolean; message: string; ok: boolean }>({ loading: false, message: "", ok: false });

  async function upload(file: File) {
    setState({ loading: true, message: "Đang kiểm tra và nhập dữ liệu…", ok: false });
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/imports/shopee-products", { method: "POST", body: form });
      const result = await response.json() as { count?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Không thể nhập file.");
      setState({ loading: false, message: `Đã nhập ${result.count ?? 0} sản phẩm thật.`, ok: true });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setState({ loading: false, message: error instanceof Error ? error.message : "Không thể nhập file.", ok: false });
    }
  }

  return <div className="import-panel">
    <div><h3>Nhập snapshot Shopee mới</h3><p>Chọn đúng file CSV được tải từ “Lấy link hàng loạt”. Mỗi file là một snapshot lịch sử.</p></div>
    <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    <button className="primary-button" disabled={state.loading} onClick={() => inputRef.current?.click()}>{state.loading ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />} Chọn CSV</button>
    {state.message && <span className={state.ok ? "import-ok" : "import-error"}>{state.ok && <Check size={14} />}{state.message}</span>}
  </div>;
}
