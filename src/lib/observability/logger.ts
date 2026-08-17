import "server-only";

import { redactSensitive } from "@/lib/observability/redact";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;
const priorities: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const rawLogLevel = process.env.LOG_LEVEL?.toLowerCase();
const configuredLevel: LogLevel = rawLogLevel && rawLogLevel in priorities ? rawLogLevel as LogLevel : "info";

function write(level: LogLevel, fields: LogFields) {
  if (priorities[level] < priorities[configuredLevel]) return;
  const record = JSON.stringify(redactSensitive({ timestamp: new Date().toISOString(), level, service: "profitos-web", ...fields }));
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export const logger = {
  debug: (fields: LogFields) => write("debug", fields),
  info: (fields: LogFields) => write("info", fields),
  warn: (fields: LogFields) => write("warn", fields),
  error: (fields: LogFields) => write("error", fields),
};
