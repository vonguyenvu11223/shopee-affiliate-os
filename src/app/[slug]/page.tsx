import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { notFound, redirect } from "next/navigation";

const modules = {
  winners: {
    title: "Winners",
    status: "MANUAL_REQUIRED",
    description: "Chỉ xuất hiện winner sau khi một experiment có đủ Báo cáo click và Báo cáo chuyển đổi đúng Sub_id, hoa hồng đã xác nhận và đạt ngưỡng SCALING.",
    actionHref: "/experiments",
    actionLabel: "Nhập kết quả experiment",
  },
  calendar: {
    title: "Lịch nội dung",
    status: "UNAVAILABLE",
    description: "Chưa có publishing provider được cấp quyền. ProfitOS không giả lập lịch đăng hoặc báo đã xuất bản.",
    actionHref: "/content",
    actionLabel: "Chuẩn bị content test",
  },
  analytics: {
    title: "Phân tích",
    status: "MANUAL_REQUIRED",
    description: "Phân tích production cần experiment đã lưu và báo cáo Shopee chính thức. Công cụ tính hiện có nằm trong trang Thử nghiệm.",
    actionHref: "/experiments",
    actionLabel: "Mở phân tích thử nghiệm",
  },
  "ai-ceo": {
    title: "AI CEO",
    status: "UNAVAILABLE",
    description: "AI không được tự ra quyết định tài chính hoặc tự động scale. Các quyết định hiện do engine tất định và evidence gate kiểm soát.",
    actionHref: "/",
    actionLabel: "Xem Command Center",
  },
  autopilot: {
    title: "Autopilot",
    status: "UNAVAILABLE",
    description: "Chưa cấu hình queue, worker và publishing provider. Không có job tự động hoặc hành động Shopee nào đang chạy ngầm.",
    actionHref: "/jobs",
    actionLabel: "Xem trạng thái Jobs",
  },
} as const;

export default async function CapabilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "command-center") redirect("/");
  const capability = modules[slug as keyof typeof modules];
  if (!capability) notFound();
  return <div className="placeholder"><div><LockKeyhole size={28} /></div><p>{capability.status}</p><h1>{capability.title}</h1><span>{capability.description}</span><Link href={capability.actionHref}>{capability.actionLabel}</Link><Link href="/"><ArrowLeft size={16} /> Về Command Center</Link></div>;
}
