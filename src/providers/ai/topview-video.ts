import "server-only";

import { ProviderCapabilityError, type ProviderStatus } from "@/providers/contracts";
import type { TopViewGenerateInput } from "@/lib/ai/video-schema";

/**
 * TopView URL-to-Video.
 *
 * API chỉ có trên gói Pro/Business — gói free không kèm API. Khi chưa có
 * TOPVIEW_API_KEY, provider giữ MANUAL_REQUIRED và người dùng đi luồng nhập
 * video thủ công (miễn phí) thay vì bị chặn hoàn toàn.
 *
 * Đường dẫn endpoint để cấu hình qua env vì tài liệu TopView có thể đổi;
 * xác nhận lại tại docs.topview.ai trước khi bật API path trong production.
 */
const DEFAULT_BASE_URL = "https://api.topview.ai";
const DEFAULT_SUBMIT_PATH = "/v1/url_to_video/create";
const DEFAULT_QUERY_PATH = "/v1/task/query";
const REQUEST_TIMEOUT_MS = 20_000;

export type TopViewTaskState = "PROCESSING" | "SUCCESS" | "FAILED";

export interface TopViewTaskResult {
  state: TopViewTaskState;
  videoUrl: string | null;
  script: string | null;
  durationSeconds: number | null;
  creditCost: number;
  failureReason: string | null;
}

function readConfig() {
  const apiKey = process.env.TOPVIEW_API_KEY?.trim();
  return {
    apiKey,
    baseUrl: process.env.TOPVIEW_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    submitPath: process.env.TOPVIEW_SUBMIT_PATH?.trim() || DEFAULT_SUBMIT_PATH,
    queryPath: process.env.TOPVIEW_QUERY_PATH?.trim() || DEFAULT_QUERY_PATH,
  };
}

export function getTopViewCapability(): ProviderStatus {
  const { apiKey } = readConfig();
  return {
    connected: Boolean(apiKey),
    capability: apiKey ? "AVAILABLE" : "MANUAL_REQUIRED",
    lastSyncAt: null,
    reason: apiKey
      ? null
      : "TOPVIEW_API_KEY chưa cấu hình. API TopView chỉ có trên gói Pro/Business; gói free không kèm API. Dùng luồng nhập video thủ công.",
  };
}

/** Quy đổi credit sang VNĐ để nạp vào contentCost. Trả 0 khi chưa cấu hình tỉ giá. */
export function creditToVnd(credits: number): number {
  const rate = Number(process.env.TOPVIEW_CREDIT_VND?.trim() || 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(credits * rate);
}

function requireApiKey(): string {
  const { apiKey } = readConfig();
  if (!apiKey) {
    throw new ProviderCapabilityError(
      "MANUAL_REQUIRED",
      "TopView API chưa khả dụng: cần gói Pro/Business và TOPVIEW_API_KEY.",
      "Tạo video trên topview.ai rồi dùng luồng nhập thủ công trong Content Studio.",
    );
  }
  return apiKey;
}

async function callTopView(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiKey = requireApiKey();
  const { baseUrl } = readConfig();
  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`TopView trả về HTTP ${response.status}.`);
  }
  const payload = await response.json() as { code?: number | string; message?: string; result?: Record<string, unknown>; data?: Record<string, unknown> };
  const success = payload.code === 0 || payload.code === "0" || payload.code === undefined;
  if (!success) throw new Error(`TopView từ chối yêu cầu: ${payload.message ?? "không rõ nguyên nhân"}.`);
  return payload.result ?? payload.data ?? {};
}

export async function submitUrlToVideo(input: TopViewGenerateInput): Promise<string> {
  const { submitPath } = readConfig();
  const result = await callTopView(submitPath, {
    url: input.productUrl,
    aspectRatio: input.aspectRatio,
    videoLength: input.durationSeconds,
  });
  const taskId = typeof result.taskId === "string" ? result.taskId : typeof result.task_id === "string" ? result.task_id : null;
  if (!taskId) throw new Error("TopView không trả về taskId.");
  return taskId;
}

export async function queryVideoTask(taskId: string): Promise<TopViewTaskResult> {
  const { queryPath } = readConfig();
  const result = await callTopView(queryPath, { taskId });
  const rawStatus = String(result.status ?? result.taskStatus ?? "").toLowerCase();
  const state: TopViewTaskState = rawStatus === "success" ? "SUCCESS" : rawStatus === "failed" || rawStatus === "error" ? "FAILED" : "PROCESSING";
  const credits = Number(result.creditCost ?? result.credits ?? 0);
  const duration = Number(result.duration ?? result.videoLength ?? 0);
  return {
    state,
    videoUrl: typeof result.videoUrl === "string" ? result.videoUrl : typeof result.downloadUrl === "string" ? result.downloadUrl : null,
    script: typeof result.script === "string" ? result.script : typeof result.caption === "string" ? result.caption : null,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    creditCost: Number.isFinite(credits) && credits > 0 ? credits : 0,
    failureReason: state === "FAILED" ? String(result.message ?? result.failReason ?? "TopView báo tạo video thất bại.") : null,
  };
}
