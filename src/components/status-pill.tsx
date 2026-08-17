import type { Recommendation, TrendStage } from "@/lib/types";
import { stageLabel } from "@/lib/format";

export function TrendPill({ stage }: { stage: TrendStage }) {
  return <span className={`pill stage-${stage.toLowerCase()}`}><i />{stageLabel[stage]}</span>;
}

export function DecisionPill({ decision }: { decision: Recommendation }) {
  const labels: Record<Recommendation, string> = { TEST_NOW: "Test ngay", WATCH: "Theo dõi", SKIP: "Bỏ qua", STOP: "Dừng", SCALE: "Scale", REVIEW: "Đánh giá" };
  return <span className={`decision decision-${decision.toLowerCase()}`}>{labels[decision]}</span>;
}
