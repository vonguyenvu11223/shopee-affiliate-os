import { AlertTriangle, Boxes, Check, Database, ServerCog, ShieldCheck } from "lucide-react";
import { getJobQueueCapability } from "@/providers/jobs/disabled-job-queue";

const queues = ["Product snapshot", "Trend calculation", "Opportunity scoring", "Content generation", "Publishing", "Analytics sync", "Daily report"];

export default function JobsPage() {
  const capability = getJobQueueCapability();
  return <>
    <div className="page-heading"><div><p>AUTOMATION / JOBS</p><h1>Job System</h1><h2>Không hiển thị tiến độ hoặc worker giả khi hạ tầng queue chưa tồn tại.</h2></div></div>
    <section className="integration-card"><div className="integration-head"><div className="shopee-logo ai-logo"><Boxes size={22} /></div><div><h3>Redis + BullMQ Worker</h3><p>Separate process · retry · idempotency</p></div><span className="status-unavailable"><i /> {capability.capability}</span></div>
      <div className="integration-alert"><AlertTriangle size={19} /><div><b>Queue chưa được bật</b><p>{capability.reason}</p></div></div>
      <div className="permission-grid"><div><Database size={17} /><span>Product/Report CSV import</span><b className="permission-ok">SYNCHRONOUS</b></div><div><Check size={17} /><span>Profit decision</span><b className="permission-ok">DATABASE RPC</b></div><div><ShieldCheck size={17} /><span>Manual publish</span><b className="permission-ok">AVAILABLE</b></div><div><ServerCog size={17} /><span>Background worker</span><b>UNAVAILABLE</b></div></div>
    </section>
    <section className="integration-card cookie-policy-card"><div className="integration-head"><div><h3>Planned queues</h3><p>Chỉ bật từng queue khi có provider và worker thật.</p></div></div><div className="permission-grid">{queues.map(queue => <div key={queue}><Boxes size={16} /><span>{queue}</span><b>LOCKED</b></div>)}</div></section>
  </>;
}
