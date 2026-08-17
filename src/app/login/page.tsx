import { Suspense } from "react";
import { DatabaseZap } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getSupabaseCapability } from "@/lib/supabase/config";

export default function LoginPage() {
  const capability = getSupabaseCapability();
  return <main className="login-page">
    {capability.auth === "AVAILABLE" ? <Suspense fallback={null}><LoginForm /></Suspense> : <section className="login-card unavailable-login"><DatabaseZap size={30} /><p>AUTH · MANUAL REQUIRED</p><h1>Supabase chưa cấu hình</h1><span>Local development vẫn dùng được. Trước khi deploy public, điền URL và anon key trong biến môi trường rồi tạo user trong Supabase Auth.</span></section>}
  </main>;
}
