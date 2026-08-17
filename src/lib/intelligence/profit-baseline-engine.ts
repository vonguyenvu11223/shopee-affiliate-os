export interface HistoricalExperimentObservation {
  experimentId: string;
  productId: string;
  category: string | null;
  views: number | null;
  clicks: number;
  orders: number;
  validOrders: number;
  validatedCommission: number;
  contentCost: number;
}

export type BaselineStatus = "INSUFFICIENT" | "LOW_CONFIDENCE" | "USABLE" | "STRONG";

export interface ProfitBaseline {
  status: BaselineStatus;
  sampleExperiments: number;
  totalClicks: number;
  totalOrders: number;
  totalValidOrders: number;
  ctr: number | null;
  conversionRate: number | null;
  validOrderRate: number | null;
  medianViews: number | null;
  medianContentCost: number | null;
  observedCommissionPerValidOrder: number | null;
  confidence: number;
}

export interface ProductValueEstimate {
  expectedViews: number;
  expectedValidOrders: number;
  expectedCommission: number;
  expectedContentCost: number;
  expectedNetProfit: number;
  expectedRoi: number | null;
  expectedCommissionPer1kViews: number;
  breakEvenViews: number | null;
  likelyNetProfitLow: number;
  likelyNetProfitHigh: number;
  confidence: number;
  baselineStatus: BaselineStatus;
}

const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const round = (value: number, precision = 2) => Number(value.toFixed(precision));
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function calculateProfitBaseline(observations: HistoricalExperimentObservation[]): ProfitBaseline {
  const valid = observations.filter(item => item.clicks >= 0 && item.orders >= 0 && item.validOrders >= 0 && item.orders <= item.clicks && item.validOrders <= item.orders && item.validatedCommission >= 0 && item.contentCost >= 0 && (item.views === null || (item.views >= item.clicks && item.views >= 0)));
  const totalClicks = valid.reduce((sum, item) => sum + item.clicks, 0);
  const totalOrders = valid.reduce((sum, item) => sum + item.orders, 0);
  const totalValidOrders = valid.reduce((sum, item) => sum + item.validOrders, 0);
  const totalCommission = valid.reduce((sum, item) => sum + item.validatedCommission, 0);
  const observationsWithViews = valid.filter(item => item.views !== null);
  const totalViews = observationsWithViews.reduce((sum, item) => sum + item.views!, 0);
  const sampleExperiments = valid.length;
  const confidence = Math.min(90, Math.round(Math.min(35, sampleExperiments * 5) + Math.min(25, totalClicks / 8) + Math.min(25, totalValidOrders * 5) + (observationsWithViews.length === sampleExperiments && sampleExperiments > 0 ? 5 : 0)));
  const status: BaselineStatus = sampleExperiments < 3 || totalClicks < 50 || totalValidOrders < 1
    ? "INSUFFICIENT" : confidence < 55 ? "LOW_CONFIDENCE" : confidence < 75 ? "USABLE" : "STRONG";
  return {
    status, sampleExperiments, totalClicks, totalOrders, totalValidOrders,
    ctr: observationsWithViews.length === sampleExperiments ? ratio(totalClicks, totalViews) : null,
    conversionRate: ratio(totalOrders, totalClicks), validOrderRate: ratio(totalValidOrders, totalOrders),
    medianViews: median(observationsWithViews.map(item => item.views!)),
    medianContentCost: median(valid.map(item => item.contentCost)),
    observedCommissionPerValidOrder: ratio(totalCommission, totalValidOrders), confidence,
  };
}

export function estimateProductValue(baseline: ProfitBaseline, commissionPerOrder: number): ProductValueEstimate | null {
  if (baseline.status === "INSUFFICIENT" || baseline.ctr === null || baseline.conversionRate === null || baseline.validOrderRate === null || baseline.medianViews === null || baseline.medianContentCost === null || commissionPerOrder <= 0) return null;
  const expectedViews = baseline.medianViews;
  const expectedValidOrders = expectedViews * baseline.ctr * baseline.conversionRate * baseline.validOrderRate;
  const expectedCommission = expectedValidOrders * commissionPerOrder;
  const expectedNetProfit = expectedCommission - baseline.medianContentCost;
  const expectedRoi = baseline.medianContentCost > 0 ? expectedNetProfit / baseline.medianContentCost : null;
  const commissionPerView = baseline.ctr * baseline.conversionRate * baseline.validOrderRate * commissionPerOrder;
  const breakEvenViews = commissionPerView > 0 ? baseline.medianContentCost / commissionPerView : null;
  const uncertainty = Math.max(0.2, 1 - baseline.confidence / 100);
  const spread = Math.max(Math.abs(expectedCommission) * uncertainty, baseline.medianContentCost * uncertainty);
  return {
    expectedViews: Math.round(expectedViews), expectedValidOrders: round(expectedValidOrders, 3),
    expectedCommission: Math.round(expectedCommission), expectedContentCost: Math.round(baseline.medianContentCost),
    expectedNetProfit: Math.round(expectedNetProfit), expectedRoi: expectedRoi === null ? null : round(expectedRoi),
    expectedCommissionPer1kViews: Math.round(commissionPerView * 1_000),
    breakEvenViews: breakEvenViews === null ? null : Math.ceil(breakEvenViews),
    likelyNetProfitLow: Math.round(expectedNetProfit - spread), likelyNetProfitHigh: Math.round(expectedNetProfit + spread),
    confidence: baseline.confidence, baselineStatus: baseline.status,
  };
}
