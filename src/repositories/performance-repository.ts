import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzePerformance, type PerformanceAnalysis } from "@/lib/intelligence/performance-engine";
import { getDecisionLineageStatus } from "@/lib/intelligence/decision-lineage";
import { summarizeAttributedPerformance, type ExperimentPerformanceSummary } from "@/lib/intelligence/performance-summary";
import type { ExperimentState } from "@/lib/intelligence/performance-engine";
import type { PerformanceRecordInput } from "@/lib/intelligence/performance-schema";
import { z } from "zod";

const ReportLineageSchema = z.object({ periodStart: z.string().date(), periodEnd: z.string().date(), attributionGroups: z.array(z.object({ trackingKey: z.string() })) });
const DashboardExperimentSchema = z.object({
  id: z.string().uuid(), state: z.enum(["TESTING", "VALIDATED", "SCALING", "DECLINING", "KILLED"]),
  budget: z.union([z.number(), z.string(), z.null()]).transform(value => value === null ? 0 : Number(value)),
  created_at: z.string(), product_id: z.string().uuid().nullable(), content_variant_id: z.string().uuid().nullable(),
});
const DashboardMetricSchema = z.object({
  id: z.string().uuid(), experiment_id: z.string().uuid(), views: z.union([z.number(), z.string(), z.null()]).transform(value => value === null ? null : Number(value)),
  clicks: z.union([z.number(), z.string()]).transform(Number), orders: z.union([z.number(), z.string()]).transform(Number),
  valid_orders: z.union([z.number(), z.string()]).transform(Number), pending_commission: z.union([z.number(), z.string()]).transform(Number),
  validated_commission: z.union([z.number(), z.string()]).transform(Number),
});

export interface SavedExperimentOption {
  id: string;
  title: string;
  trackingKey: string;
  state: string;
  budget: number;
  createdAt: string;
}

export interface PerformanceDashboardExperiment {
  id: string;
  title: string;
  productName: string;
  trackingKey: string | null;
  storedState: ExperimentState;
  createdAt: string;
  summary: ExperimentPerformanceSummary & { analysis: PerformanceAnalysis | null };
}

export async function getPerformanceDashboard(): Promise<PerformanceDashboardExperiment[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: experimentData, error: experimentError } = await supabase.from("content_experiments")
    .select("id,state,budget,created_at,product_id,content_variant_id")
    .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(200);
  if (experimentError) throw new Error(`Không thể đọc experiment dashboard: ${experimentError.message}`);
  const experiments = z.array(DashboardExperimentSchema).parse(experimentData ?? []);
  if (!experiments.length) return [];

  const productIds = experiments.flatMap(item => item.product_id ? [item.product_id] : []);
  const variantIds = experiments.flatMap(item => item.content_variant_id ? [item.content_variant_id] : []);
  const experimentIds = experiments.map(item => item.id);
  const [productResult, variantResult, metricResult] = await Promise.all([
    productIds.length ? supabase.from("products").select("id,title").in("id", productIds) : Promise.resolve({ data: [], error: null }),
    variantIds.length ? supabase.from("content_variants").select("id,tracking_key,content_project_id").in("id", variantIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("performance_metrics").select("id,experiment_id,views,clicks,orders,valid_orders,pending_commission,validated_commission").in("experiment_id", experimentIds),
  ]);
  if (productResult.error || variantResult.error || metricResult.error) throw new Error("Không thể tổng hợp dữ liệu performance dashboard.");
  const products = z.array(z.object({ id: z.string().uuid(), title: z.string() })).parse(productResult.data ?? []);
  const variants = z.array(z.object({ id: z.string().uuid(), tracking_key: z.string().nullable(), content_project_id: z.string().uuid().nullable() })).parse(variantResult.data ?? []);
  const metrics = z.array(DashboardMetricSchema).parse(metricResult.data ?? []);
  const projectIds = variants.flatMap(item => item.content_project_id ? [item.content_project_id] : []);
  const metricIds = metrics.map(item => item.id);
  const [projectResult, lineageResult] = await Promise.all([
    projectIds.length ? supabase.from("content_projects").select("id,title").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
    metricIds.length ? supabase.from("performance_metric_import_runs").select("performance_metric_id,report_role").in("performance_metric_id", metricIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (projectResult.error || lineageResult.error) throw new Error("Không thể kiểm tra lineage của performance dashboard.");
  const projects = z.array(z.object({ id: z.string().uuid(), title: z.string() })).parse(projectResult.data ?? []);
  const lineages = z.array(z.object({ performance_metric_id: z.string().uuid(), report_role: z.enum(["CLICK", "CONVERSION"]) })).parse(lineageResult.data ?? []);
  const productMap = new Map(products.map(item => [item.id, item.title]));
  const variantMap = new Map(variants.map(item => [item.id, item]));
  const projectMap = new Map(projects.map(item => [item.id, item.title]));

  return experiments.map(experiment => {
    const variant = variantMap.get(experiment.content_variant_id ?? "");
    const periods = metrics.filter(metric => metric.experiment_id === experiment.id).map(metric => ({
      views: metric.views, clicks: metric.clicks, orders: metric.orders, validOrders: metric.valid_orders,
      pendingCommission: metric.pending_commission, validatedCommission: metric.validated_commission,
      reportRoles: lineages.filter(item => item.performance_metric_id === metric.id).map(item => item.report_role),
    }));
    const summary = summarizeAttributedPerformance(periods, experiment.budget);
    return {
      id: experiment.id,
      title: projectMap.get(variant?.content_project_id ?? "") ?? "Experiment chưa đặt tên",
      productName: productMap.get(experiment.product_id ?? "") ?? "Sản phẩm không còn khả dụng",
      trackingKey: variant?.tracking_key ?? null,
      storedState: experiment.state,
      createdAt: experiment.created_at,
      summary: { ...summary, analysis: summary.totals ? analyzePerformance(summary.totals) : null },
    };
  });
}

export async function getSavedExperiments(): Promise<SavedExperimentOption[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data: experiments, error } = await supabase.from("content_experiments")
    .select("id,state,budget,created_at,content_variant_id")
    .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100);
  if (error || !experiments?.length) return [];
  const variantIds = experiments.map(item => item.content_variant_id).filter(Boolean) as string[];
  const { data: variants } = await supabase.from("content_variants")
    .select("id,tracking_key,content_project_id").in("id", variantIds);
  const projectIds = (variants ?? []).map(item => item.content_project_id).filter(Boolean) as string[];
  const { data: projects } = projectIds.length
    ? await supabase.from("content_projects").select("id,title").in("id", projectIds)
    : { data: [] as { id: string; title: string }[] };
  const variantMap = new Map((variants ?? []).map(item => [item.id, item]));
  const projectMap = new Map((projects ?? []).map(item => [item.id, item.title]));
  return experiments.map(item => {
    const variant = variantMap.get(item.content_variant_id ?? "");
    return {
      id: item.id,
      title: projectMap.get(variant?.content_project_id ?? "") ?? "Experiment chưa đặt tên",
      trackingKey: variant?.tracking_key ?? "Chưa có tracking key",
      state: item.state,
      budget: Number(item.budget) || 0,
      createdAt: item.created_at,
    };
  });
}

export async function persistPerformanceRecord(userId: string, input: PerformanceRecordInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Database chưa được cấu hình.");
  const { data: experiment, error } = await supabase.from("content_experiments")
    .select("id,budget,content_variant_id").eq("id", input.experimentId).eq("user_id", userId).single();
  if (error || !experiment) throw new Error("Experiment không tồn tại hoặc không thuộc tài khoản này.");
  const { data: variant, error: variantError } = await supabase.from("content_variants").select("tracking_key").eq("id", experiment.content_variant_id).eq("user_id", userId).single();
  if (variantError || !variant?.tracking_key) throw new Error("Experiment chưa có tracking key hợp lệ.");
  const validateLineage = async (importRunId: string | null | undefined, expectedType: "CLICK_REPORT" | "CONVERSION_REPORT") => {
    if (!importRunId) return;
    const { data: run, error: runError } = await supabase.from("import_runs").select("import_type,status,parsed_summary").eq("id", importRunId).eq("user_id", userId).single();
    if (runError || !run || run.import_type !== expectedType || run.status !== "COMPLETED") throw new Error("Nguồn báo cáo không hợp lệ hoặc không thuộc tài khoản này.");
    const summary = ReportLineageSchema.safeParse(run.parsed_summary);
    if (!summary.success || summary.data.periodStart !== input.periodStart || summary.data.periodEnd !== input.periodEnd || !summary.data.attributionGroups.some(group => group.trackingKey === variant.tracking_key)) {
      throw new Error(`Báo cáo không khớp khoảng ngày hoặc Sub_id của experiment (${variant.tracking_key}).`);
    }
  };
  await validateLineage(input.clickImportRunId, "CLICK_REPORT");
  await validateLineage(input.conversionImportRunId, "CONVERSION_REPORT");
  const performanceInput = {
    views: input.views,
    clicks: input.clicks,
    orders: input.orders,
    validOrders: input.validOrders,
    validatedCommission: input.validatedCommission,
    pendingCommission: input.pendingCommission,
    contentCost: Number(experiment.budget) || 0,
  };
  const analysis = analyzePerformance(performanceInput);
  const lineageStatus = getDecisionLineageStatus(analysis.state, {
    click: input.clickImportRunId ?? null,
    conversion: input.conversionImportRunId ?? null,
  });
  if (!lineageStatus.ready) {
    throw new Error(`Quyết định ${analysis.state} cần đủ Báo cáo click và Báo cáo chuyển đổi chính thức cùng Sub_id. Còn thiếu: ${lineageStatus.missing.join(", ")}.`);
  }
  const { data: decisionId, error: saveError } = await supabase.rpc("save_performance_decision", {
    p_experiment_id: input.experimentId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_views: input.views,
    p_clicks: input.clicks,
    p_orders: input.orders,
    p_valid_orders: input.validOrders,
    p_pending_commission: input.pendingCommission,
    p_validated_commission: input.validatedCommission,
    p_state: analysis.state,
    p_diagnosis: analysis.diagnosis,
    p_next_best_action: analysis.nextBestAction,
    p_confidence: analysis.confidence,
    p_metrics_snapshot: { input: performanceInput, analysis },
    p_click_import_run_id: input.clickImportRunId ?? null,
    p_conversion_import_run_id: input.conversionImportRunId ?? null,
  });
  if (saveError) throw new Error(`Không thể lưu kết quả hiệu suất: ${saveError.message}`);
  return { decisionId, analysis, contentCost: performanceInput.contentCost };
}
