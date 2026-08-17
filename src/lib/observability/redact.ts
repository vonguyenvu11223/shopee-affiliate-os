const SENSITIVE_KEYS = /^(password|passcode|authorization|cookie|set-cookie|access_?token|refresh_?token|api_?key|secret|service_?role_?key)$/i;

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, 500) };
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redactSensitive(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redactSensitive(entry, depth + 1)]));
  }
  if (typeof value === "string") return value.length > 2_000 ? `${value.slice(0, 2_000)}…[TRUNCATED]` : value;
  return value;
}
