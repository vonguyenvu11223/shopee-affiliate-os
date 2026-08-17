export interface AttributedPerformancePeriod {
  views: number | null;
  clicks: number;
  orders: number;
  validOrders: number;
  pendingCommission: number;
  validatedCommission: number;
  reportRoles: Array<"CLICK" | "CONVERSION">;
}

export interface ExperimentPerformanceSummary {
  periodCount: number;
  lineageComplete: boolean;
  missingLineagePeriods: number;
  totals: {
    views: number | null;
    clicks: number;
    orders: number;
    validOrders: number;
    pendingCommission: number;
    validatedCommission: number;
    contentCost: number;
  } | null;
}

const hasCompleteLineage = (period: AttributedPerformancePeriod) =>
  period.reportRoles.includes("CLICK") && period.reportRoles.includes("CONVERSION");

export function summarizeAttributedPerformance(
  periods: AttributedPerformancePeriod[],
  contentCost: number,
): ExperimentPerformanceSummary {
  const missingLineagePeriods = periods.filter(period => !hasCompleteLineage(period)).length;
  if (!periods.length || missingLineagePeriods > 0) {
    return {
      periodCount: periods.length,
      lineageComplete: false,
      missingLineagePeriods,
      totals: null,
    };
  }

  const viewsComplete = periods.every(period => period.views !== null);
  const totals = {
    views: viewsComplete ? periods.reduce((sum, period) => sum + (period.views ?? 0), 0) : null,
    clicks: periods.reduce((sum, period) => sum + period.clicks, 0),
    orders: periods.reduce((sum, period) => sum + period.orders, 0),
    validOrders: periods.reduce((sum, period) => sum + period.validOrders, 0),
    pendingCommission: periods.reduce((sum, period) => sum + period.pendingCommission, 0),
    validatedCommission: periods.reduce((sum, period) => sum + period.validatedCommission, 0),
    contentCost: Math.max(0, contentCost),
  };
  return {
    periodCount: periods.length,
    lineageComplete: true,
    missingLineagePeriods: 0,
    totals,
  };
}
