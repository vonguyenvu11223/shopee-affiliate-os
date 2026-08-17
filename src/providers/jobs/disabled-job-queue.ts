import "server-only";

import { ProviderCapabilityError, type ProviderStatus } from "@/providers/contracts";
import type { EnqueueJobInput, EnqueuedJob, JobQueueProvider } from "@/providers/jobs/contracts";

export function getJobQueueCapability(): ProviderStatus {
  return {
    connected: false,
    capability: "UNAVAILABLE",
    lastSyncAt: null,
    reason: process.env.REDIS_URL?.trim()
      ? "REDIS_URL đã có nhưng worker/BullMQ chưa được triển khai; queue vẫn bị khóa để tránh job giả."
      : "Chưa cấu hình Redis và worker riêng. Các luồng hiện tại chạy đồng bộ hoặc yêu cầu thao tác thủ công.",
  };
}

export class DisabledJobQueueProvider implements JobQueueProvider {
  async getStatus() { return getJobQueueCapability(); }
  async enqueue(input: EnqueueJobInput): Promise<EnqueuedJob> {
    void input;
    throw new ProviderCapabilityError("UNAVAILABLE", getJobQueueCapability().reason ?? "Job queue chưa khả dụng.", "Triển khai Redis + BullMQ worker trước khi bật enqueue.");
  }
}
