import "server-only";

import { randomUUID } from "node:crypto";
import { logger } from "@/lib/observability/logger";

export function createRequestTelemetry(request: Request, action: string) {
  const supplied = request.headers.get("x-request-id") ?? "";
  const requestId = /^[a-zA-Z0-9_-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  const startedAt = Date.now();
  const base = { event: "request", action, requestId, method: request.method };
  return {
    completed(fields: Record<string, unknown> = {}) { logger.info({ ...base, outcome: "COMPLETED", durationMs: Date.now() - startedAt, ...fields }); },
    rejected(status: number, reason: string) { logger.warn({ ...base, outcome: "REJECTED", status, reason, durationMs: Date.now() - startedAt }); },
    failed(error: unknown, fields: Record<string, unknown> = {}) { logger.error({ ...base, outcome: "FAILED", durationMs: Date.now() - startedAt, error, ...fields }); },
  };
}
