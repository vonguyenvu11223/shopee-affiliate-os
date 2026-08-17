import { FileInput, ShieldCheck } from "lucide-react";
import { AttributionBuilder } from "@/components/attribution-builder";
import { PerformanceCalculator } from "@/components/performance-calculator";
import { TikTokReportImporter } from "@/components/tiktok-report-importer";
import { getSupabaseCapability } from "@/lib/supabase/config";
import { getSavedExperiments } from "@/repositories/performance-repository";

export default async function ExperimentsPage() {
  const databaseEnabled = getSupabaseCapability().database === "AVAILABLE";
  const experiments = databaseEnabled ? await getSavedExperiments() : [];
  return <>
    <div className="page-heading"><div><p>PROFIT INTELLIGENCE · REAL INPUT</p><h1>Thử nghiệm & Lợi nhuận</h1><h2>Biến số liệu thật thành quyết định có điều kiện, không dùng doanh số sản phẩm để giả định lợi nhuận affiliate.</h2></div></div>
    <div className="manual-notice"><FileInput size={19} /><div><b>Chế độ nhập thủ công đang hoạt động</b><p>Tài khoản chưa được Shopee cấp Open API. Hãy nhập các chỉ số cùng khoảng ngày; bước kế tiếp sẽ hỗ trợ tải báo cáo click và chuyển đổi.</p></div><span><ShieldCheck size={15} /> Không dữ liệu giả</span></div>
    <AttributionBuilder />
    <PerformanceCalculator databaseEnabled={databaseEnabled} experiments={experiments} />
    <TikTokReportImporter enabled={databaseEnabled} />
  </>;
}
