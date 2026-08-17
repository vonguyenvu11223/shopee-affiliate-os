export type ExperimentState = "TESTING" | "VALIDATED" | "SCALING" | "DECLINING" | "KILLED";
export type FunnelDiagnosis = "INSUFFICIENT_DATA" | "DISTRIBUTION" | "CREATIVE" | "PRODUCT_OR_OFFER" | "ORDER_QUALITY" | "HEALTHY";

export interface PerformanceInput {
  views: number | null;
  clicks: number;
  orders: number;
  validOrders: number;
  validatedCommission: number;
  pendingCommission: number;
  contentCost: number;
}

export interface PerformanceThresholds {
  minimumClicks: number;
  killClicksWithoutOrder: number;
  minimumCtr: number;
  minimumConversionRate: number;
  minimumValidOrderRate: number;
  scaleValidOrders: number;
  scaleRoi: number;
}

export interface PerformanceAnalysis {
  ctr: number | null;
  conversionRate: number | null;
  validOrderRate: number | null;
  epc: number | null;
  affiliateRpm: number | null;
  netProfit: number;
  roi: number | null;
  confidence: number;
  state: ExperimentState;
  diagnosis: FunnelDiagnosis;
  nextBestAction: string;
}

export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  minimumClicks: 30,
  killClicksWithoutOrder: 100,
  minimumCtr: 0.01,
  minimumConversionRate: 0.02,
  minimumValidOrderRate: 0.7,
  scaleValidOrders: 5,
  scaleRoi: 2,
};

const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const round = (value: number | null, precision = 4) => value === null ? null : Number(value.toFixed(precision));
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function analyzePerformance(input: PerformanceInput, thresholds = DEFAULT_THRESHOLDS): PerformanceAnalysis {
  const ctr = input.views === null ? null : ratio(input.clicks, input.views);
  const conversionRate = ratio(input.orders, input.clicks);
  const validOrderRate = ratio(input.validOrders, input.orders);
  const epc = ratio(input.validatedCommission, input.clicks);
  const affiliateRpm = input.views === null ? null : ratio(input.validatedCommission * 1_000, input.views);
  const netProfit = input.validatedCommission - input.contentCost;
  const roi = input.contentCost > 0 ? netProfit / input.contentCost : null;

  const sampleConfidence = clamp(
    Math.min(45, input.clicks / thresholds.minimumClicks * 30) +
    Math.min(35, input.orders * 7) +
    (input.views !== null ? 10 : 0) +
    (input.validOrders > 0 ? 10 : 0),
  );

  let diagnosis: FunnelDiagnosis = "INSUFFICIENT_DATA";
  if (input.clicks >= thresholds.minimumClicks) {
    if (input.views !== null && ctr !== null && ctr < thresholds.minimumCtr) diagnosis = "CREATIVE";
    else if (conversionRate !== null && conversionRate < thresholds.minimumConversionRate) diagnosis = "PRODUCT_OR_OFFER";
    else if (validOrderRate !== null && validOrderRate < thresholds.minimumValidOrderRate) diagnosis = "ORDER_QUALITY";
    else diagnosis = "HEALTHY";
  } else if (input.views !== null && input.views >= 1_000 && input.clicks < thresholds.minimumClicks) {
    diagnosis = "DISTRIBUTION";
  }

  let state: ExperimentState = "TESTING";
  if (input.clicks >= thresholds.killClicksWithoutOrder && input.orders === 0) state = "KILLED";
  else if (input.validOrders >= thresholds.scaleValidOrders && roi !== null && roi >= thresholds.scaleRoi) state = "SCALING";
  else if (input.validOrders >= 1 && netProfit >= 0) state = "VALIDATED";
  else if (input.orders > 0 && validOrderRate !== null && validOrderRate < thresholds.minimumValidOrderRate) state = "DECLINING";

  const actions: Record<ExperimentState | FunnelDiagnosis, string> = {
    TESTING: "Tiếp tục thu thập dữ liệu trong giới hạn ngân sách test.",
    VALIDATED: "Tạo thêm một biến thể creative trước khi tăng ngân sách.",
    SCALING: "Scale có kiểm soát và theo dõi trend decay.",
    DECLINING: "Giảm phân bổ và kiểm tra chất lượng đơn hàng.",
    KILLED: "Dừng test; không phát sinh thêm chi phí cho cấu hình này.",
    INSUFFICIENT_DATA: "Thu thập thêm click và đơn hàng trước khi kết luận.",
    DISTRIBUTION: "Kiểm tra khả năng phân phối và first-frame của nội dung.",
    CREATIVE: "Giữ sản phẩm, thay hook/creative và test lại.",
    PRODUCT_OR_OFFER: "Dừng creative mới; đánh giá lại sản phẩm, giá và offer.",
    ORDER_QUALITY: "Kiểm tra seller, tồn kho và nguyên nhân đơn không hợp lệ.",
    HEALTHY: "Tiếp tục test cho đến khi đạt ngưỡng xác thực.",
  };
  const nextBestAction = state === "TESTING" && diagnosis !== "INSUFFICIENT_DATA" ? actions[diagnosis] : actions[state];

  return {
    ctr: round(ctr), conversionRate: round(conversionRate), validOrderRate: round(validOrderRate),
    epc: round(epc, 2), affiliateRpm: round(affiliateRpm, 2), netProfit,
    roi: round(roi, 2), confidence: Math.round(sampleConfidence), state, diagnosis, nextBestAction,
  };
}
