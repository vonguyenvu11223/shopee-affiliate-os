import { Bot, KeyRound, ShieldCheck } from "lucide-react";
import { getOpenAiCapability } from "@/providers/ai/openai-content";

export default function AiSettingsPage() {
  const capability = getOpenAiCapability();
  const available = capability.status === "AVAILABLE";
  return <>
    <div className="page-heading"><div><p>AI PROVIDER · SERVER ONLY</p><h1>AI Settings</h1><h2>AI dùng để tạo ý tưởng/diễn giải có cấu trúc; mọi phép tính tài chính vẫn do TypeScript/PostgreSQL xử lý.</h2></div></div>
    <section className="integration-card"><div className="integration-head"><div className="shopee-logo ai-logo"><Bot size={23} /></div><div><h3>OpenAI Responses API</h3><p>Structured Outputs · Zod · server-side key</p></div><span className={available ? "status-connected" : "status-unavailable"}><i /> {capability.status}</span></div>
      <div className={available ? "integration-success" : "integration-alert"}><KeyRound size={19} /><div><b>{available ? "Provider đã cấu hình" : "Cần OPENAI_API_KEY"}</b><p>{available ? `Model: ${capability.model}. Khóa không bao giờ gửi xuống browser.` : "Thêm secret vào môi trường server; không dán API key vào form hoặc source code."}</p></div></div>
      <div className="permission-grid"><div><ShieldCheck size={17} /><span>Structured output</span><b className={available ? "permission-ok" : ""}>{available ? "AVAILABLE" : "MANUAL REQUIRED"}</b></div><div><ShieldCheck size={17} /><span>Content brief</span><b className={available ? "permission-ok" : ""}>{available ? "AVAILABLE" : "MANUAL REQUIRED"}</b></div><div><ShieldCheck size={17} /><span>Deterministic finance</span><b className="permission-ok">LOCAL ENGINE</b></div><div><ShieldCheck size={17} /><span>Auto publish</span><b>UNAVAILABLE</b></div></div>
    </section>
  </>;
}
