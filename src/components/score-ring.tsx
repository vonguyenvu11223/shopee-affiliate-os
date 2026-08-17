export function ScoreRing({ score, size = 42 }: { score: number | null; size?: number }) {
  if (score === null) return <div className="score-ring score-ring-empty" style={{ width: size, height: size }}><span>—</span></div>;
  const tone = score >= 85 ? "#11a36a" : score >= 70 ? "#e59a18" : "#e05a4f";
  return <div className="score-ring" style={{ width: size, height: size, background: `conic-gradient(${tone} ${score * 3.6}deg, #e9eceb 0deg)` }}><span>{score}</span></div>;
}
