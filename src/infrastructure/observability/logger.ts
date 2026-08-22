type LogContext = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 4000;
const SENSITIVE_KEY = /(?:authorization|cookie|set-cookie|password|passwd|secret|token|service[_-]?role|api[_-]?key|signed[_-]?url|refresh[_-]?token|access[_-]?token|file[_-]?(?:name|path)|original[_-]?name|storage[_-]?path|object[_-]?path|qr[_-]?code|otpauth|manual[_-]?key|authenticator[_-]?secret)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const URL_SECRET = /([?&](?:token|access_token|refresh_token|signature|sig|key|api_key|apikey|x-amz-signature|x-amz-credential)=)[^&#\s]+/gi;

function sanitizeString(value: string): string {
  const normalized = value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(JWT, REDACTED)
    .replace(URL_SECRET, "$1[REDACTED]")
    .replace(EMAIL, "[REDACTED_EMAIL]");
  return normalized.length > MAX_STRING_LENGTH
    ? `${normalized.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`
    : normalized;
}

function sanitizeValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return toErrorDetails(value, depth + 1, seen);
  if (typeof value !== "object") return sanitizeString(String(value));
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} itens]`);
    return items;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const productionStack =
      process.env.NODE_ENV === "production" && key.toLowerCase() === "stack";
    if (productionStack) continue;
    output[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(item, depth + 1, seen);
  }
  return output;
}

function toErrorDetails(
  error: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: sanitizeString(error.name),
      message: sanitizeString(error.message),
    };
    if (process.env.NODE_ENV !== "production" && error.stack) {
      details.stack = sanitizeString(error.stack);
    }
    if (error.cause !== undefined) {
      details.cause = sanitizeValue(error.cause, depth + 1, seen);
    }
    return details;
  }

  const sanitized = sanitizeValue(error, depth + 1, seen);
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : { error: sanitized ?? "unknown_error" };
}

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function baseContext(context: LogContext): Record<string, unknown> {
  const sanitized = sanitizeValue(context);
  const sanitizedContext =
    typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
      ? sanitized as Record<string, unknown>
      : {};
  const requestId =
    typeof sanitizedContext.requestId === "string" && sanitizedContext.requestId.length > 0
      ? sanitizedContext.requestId
      : generateRequestId();

  return {
    ts: new Date().toISOString(),
    ...sanitizedContext,
    service: "orienta",
    environment: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown",
    release:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
      process.env.GITHUB_SHA?.slice(0, 12) ||
      "local",
    requestId,
  };
}

export function logInfo(message: string, context: LogContext = {}) {
  console.info(`[orienta-v1] ${sanitizeString(message)}`, baseContext(context));
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
  console.error(`[orienta-v1] ${sanitizeString(message)}`, {
    ...baseContext(context),
    ...toErrorDetails(error),
  });
}

export function logWarn(message: string, error: unknown, context: LogContext = {}) {
  console.warn(`[orienta-v1] ${sanitizeString(message)}`, {
    ...baseContext(context),
    ...toErrorDetails(error),
  });
}

/** Exportado apenas para testes de regressão da política de redaction. */
export const __loggerTesting = { sanitizeString, sanitizeValue };
