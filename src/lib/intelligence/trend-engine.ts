import type { TrendStage } from "../types";

export interface ProductSnapshotPoint {
  sold: number | null;
  capturedAt: string;
}

export interface TrendAnalysis {
  salesVelocity24h: number | null;
  growth24h: number | null;
  acceleration: number | null;
  trendScore: number | null;
  trendStage: TrendStage;
  urgencyScore: number | null;
  confidence: number | null;
  dataQualityScore: number;
  halfLife: string;
}

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, precision = 2) => Number(value.toFixed(precision));
const hoursBetween = (start: string, end: string) => (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;

function emptyAnalysis(snapshotCount: number): TrendAnalysis {
  return {
    salesVelocity24h: null, growth24h: null, acceleration: null, trendScore: null,
    trendStage: "DISCOVERY", urgencyScore: null, confidence: null,
    dataQualityScore: Math.min(30, snapshotCount * 15), halfLife: "Chưa đủ dữ liệu",
  };
}

export function analyzeProductTrend(points: ProductSnapshotPoint[]): TrendAnalysis {
  const history = [...points]
    .filter(point => point.sold !== null && Number.isFinite(point.sold) && !Number.isNaN(new Date(point.capturedAt).getTime()))
    .sort((left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime());
  if (history.length < 2) return emptyAnalysis(history.length);

  const latest = history.at(-1)!;
  const previous = history.at(-2)!;
  const currentHours = hoursBetween(previous.capturedAt, latest.capturedAt);
  const currentDelta = latest.sold! - previous.sold!;
  if (currentHours <= 0 || currentDelta < 0) return { ...emptyAnalysis(history.length), dataQualityScore: 10 };

  const currentHourlyVelocity = currentDelta / currentHours;
  const salesVelocity24h = currentHourlyVelocity * 24;
  const growth24h = previous.sold! > 0 ? (salesVelocity24h / previous.sold!) * 100 : null;
  let acceleration: number | null = null;
  if (history.length >= 3) {
    const earlier = history.at(-3)!;
    const previousHours = hoursBetween(earlier.capturedAt, previous.capturedAt);
    const previousDelta = previous.sold! - earlier.sold!;
    if (previousHours > 0 && previousDelta >= 0) {
      const previousHourlyVelocity = previousDelta / previousHours;
      if (previousHourlyVelocity > 0) acceleration = currentHourlyVelocity / previousHourlyVelocity;
      else if (currentHourlyVelocity === 0) acceleration = 1;
    }
  }

  const intervals = history.slice(1).map((point, index) => hoursBetween(history[index].capturedAt, point.capturedAt));
  const validIntervals = intervals.filter(interval => interval > 0);
  const intervalMean = validIntervals.reduce((sum, interval) => sum + interval, 0) / Math.max(1, validIntervals.length);
  const intervalVariance = validIntervals.reduce((sum, interval) => sum + Math.abs(interval - intervalMean), 0) / Math.max(1, validIntervals.length);
  const consistency = intervalMean > 0 ? clamp(100 - (intervalVariance / intervalMean) * 100) : 0;
  const monotonic = history.every((point, index) => index === 0 || point.sold! >= history[index - 1].sold!);
  // Shopee bulk-link exports use compact cumulative sales values (for example 10k+), so confidence is capped.
  const dataQualityScore = Math.round(Math.min(72,
    Math.min(40, history.length * 12) + (monotonic ? 17 : 0) + consistency * 0.15,
  ));
  const confidence = Math.round(Math.min(dataQualityScore, history.length >= 3 ? 68 : 45));

  const growthSignal = growth24h === null ? 0 : clamp(growth24h * 8, 0, 42);
  const velocitySignal = salesVelocity24h > 0 ? clamp(Math.log10(salesVelocity24h + 1) * 9, 0, 28) : 0;
  const accelerationSignal = acceleration === null ? 0 : clamp((acceleration - 0.5) * 20, 0, 30);
  const trendScore = Math.round(clamp(growthSignal + velocitySignal + accelerationSignal));

  let trendStage: TrendStage = "DISCOVERY";
  if (history.length === 2 && salesVelocity24h > 0 && (growth24h ?? 0) >= 0.5) trendStage = "EARLY_RISING";
  if (history.length >= 3) {
    if (salesVelocity24h <= 0) trendStage = "SATURATED";
    else if (acceleration !== null && acceleration >= 1.8 && trendScore >= 60) trendStage = "BREAKOUT";
    else if (acceleration !== null && acceleration >= 1.15) trendStage = "EARLY_RISING";
    else if (acceleration !== null && acceleration < 0.5) trendStage = "DECLINING";
    else trendStage = "TRENDING";
  }

  const stageUrgency: Record<TrendStage, number> = {
    DISCOVERY: 20, EARLY_RISING: 72, BREAKOUT: 92, TRENDING: 60,
    PEAKING: 48, SATURATED: 25, DECLINING: 15, DEAD: 0,
  };
  const urgencyScore = Math.round(stageUrgency[trendStage] * (confidence / 100));
  const halfLife: Record<TrendStage, string> = {
    DISCOVERY: "Chưa đủ dữ liệu", EARLY_RISING: "1–3 ngày", BREAKOUT: "12–24h",
    TRENDING: "3–7 ngày", PEAKING: "12–24h", SATURATED: "Evergreen/đã bão hòa",
    DECLINING: "< 24h", DEAD: "Đã kết thúc",
  };

  return {
    salesVelocity24h: round(salesVelocity24h), growth24h: growth24h === null ? null : round(growth24h),
    acceleration: acceleration === null ? null : round(acceleration), trendScore, trendStage,
    urgencyScore, confidence, dataQualityScore, halfLife: halfLife[trendStage],
  };
}
