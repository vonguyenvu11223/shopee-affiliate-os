"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError("Supabase Auth chưa được cấu hình."); setLoading(false); return; }
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) { setError("Email hoặc mật khẩu không đúng."); setLoading(false); return; }
    const nextPath = searchParams.get("next");
    router.replace(nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/");
    router.refresh();
  };

  return <form className="login-card" onSubmit={submit}>
    <div className="login-mark"><LockKeyhole size={24} /></div><p>PROFITOS SECURE ACCESS</p><h1>Đăng nhập</h1><span>Dùng tài khoản được tạo trong Supabase Auth của dự án.</span>
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label>Mật khẩu<input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <b className="login-error">{error}</b>}
    <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <LockKeyhole size={15} />} Đăng nhập</button>
  </form>;
}
