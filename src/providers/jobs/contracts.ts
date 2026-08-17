import type { ProviderStatus } from "@/providers/contracts";

export type JobType = "PRODUCT_SNAPSHOT" | "TREND_CALCULATION" | "OPPORTUNITY_SCORING" | "CONTENT_GENERATION" | "PUBLISHING" | "ANALYTICS_SYNC" | "DAILY_REPORT";
export type JobState = "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export interface EnqueueJobInput { type: JobType; payload: Record<string, unknown>; idempotencyKey: string }
export interface EnqueuedJob { id: string; type: JobType; state: JobState; queuedAt: string }

export interface JobQueueProvider {
  getStatus(): Promise<ProviderStatus>;
  enqueue(input: EnqueueJobInput): Promise<EnqueuedJob>;
}
