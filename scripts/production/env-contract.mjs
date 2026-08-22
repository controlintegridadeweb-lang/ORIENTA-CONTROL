export const VERCEL_REQUIRED_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "HEALTHCHECK_SECRET",
];

export const VERCEL_OPTIONAL_KEYS = [
  "NOTIFICATION_WEBHOOK_URL",
  "NOTIFICATION_WEBHOOK_SECRET",
];

export const VERCEL_FORBIDDEN_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "ORIENTA_RESPONDENT_INITIAL_PASSWORD",
];

export const VERCEL_FORBIDDEN_PREFIXES = ["E2E_", "ORIENTA_SOURCE_", "ORIENTA_TARGET_"];

export const LOCAL_ONLY_KEYS = [
  ...VERCEL_FORBIDDEN_KEYS,
  "BACKUP_AGE_RECIPIENT",
  "BACKUP_AGE_IDENTITY",
  "RESTORE_DRILL_TARGET_DB_URL",
  "RESTORE_DRILL_CONFIRM_TARGET",
  "PRODUCTION_BASE_URL",
  "EXPECTED_COMMIT",
];

const PLACEHOLDER = /(?:coloque_|example|exemplo|changeme|replace_me|your[_-]|seu-dominio|localhost)/i;

function valueOf(env, key) {
  return String(env[key] ?? "").trim();
}

function addIssue(issues, key, code) {
  if (!issues.some((issue) => issue.key === key && issue.code === code)) {
    issues.push({ key, code });
  }
}

function parseHttpsUrl(env, issues, key, { originOnly }) {
  const raw = valueOf(env, key);
  if (!raw) return;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") addIssue(issues, key, "insecure_url");
    if (parsed.username || parsed.password) addIssue(issues, key, "credentials_in_url");
    if (originOnly && (parsed.pathname !== "/" || parsed.search || parsed.hash)) {
      addIssue(issues, key, "must_be_origin");
    }
  } catch {
    addIssue(issues, key, "invalid_url");
  }
  if (PLACEHOLDER.test(raw)) addIssue(issues, key, "placeholder");
}

function secret(env, issues, key, min) {
  const raw = valueOf(env, key);
  if (!raw) return;
  if (raw.length < min) addIssue(issues, key, "weak_secret");
  if (/\s/.test(raw)) addIssue(issues, key, "contains_whitespace");
  if (PLACEHOLDER.test(raw)) addIssue(issues, key, "placeholder");
}

export function validateProductionEnv(env) {
  const issues = [];
  for (const key of VERCEL_REQUIRED_KEYS) {
    if (!valueOf(env, key)) addIssue(issues, key, "missing");
  }

  parseHttpsUrl(env, issues, "NEXT_PUBLIC_APP_URL", { originOnly: true });
  parseHttpsUrl(env, issues, "NEXT_PUBLIC_SUPABASE_URL", { originOnly: true });
  secret(env, issues, "NEXT_PUBLIC_SUPABASE_ANON_KEY", 32);
  secret(env, issues, "SUPABASE_SERVICE_ROLE_KEY", 32);
  secret(env, issues, "CRON_SECRET", 32);
  secret(env, issues, "HEALTHCHECK_SECRET", 32);

  if (valueOf(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY") === valueOf(env, "SUPABASE_SERVICE_ROLE_KEY")) {
    addIssue(issues, "SUPABASE_SERVICE_ROLE_KEY", "duplicates_anon_key");
  }
  if (valueOf(env, "CRON_SECRET") === valueOf(env, "HEALTHCHECK_SECRET")) {
    addIssue(issues, "HEALTHCHECK_SECRET", "duplicates_cron_secret");
  }

  const webhookUrl = valueOf(env, "NOTIFICATION_WEBHOOK_URL");
  const webhookSecret = valueOf(env, "NOTIFICATION_WEBHOOK_SECRET");
  if (Boolean(webhookUrl) !== Boolean(webhookSecret)) {
    addIssue(issues, webhookUrl ? "NOTIFICATION_WEBHOOK_SECRET" : "NOTIFICATION_WEBHOOK_URL", "pair_required");
  }
  if (webhookUrl) parseHttpsUrl(env, issues, "NOTIFICATION_WEBHOOK_URL", { originOnly: false });
  if (webhookSecret) secret(env, issues, "NOTIFICATION_WEBHOOK_SECRET", 24);

  for (const key of VERCEL_FORBIDDEN_KEYS) {
    if (valueOf(env, key)) addIssue(issues, key, "forbidden_in_runtime");
  }
  for (const key of Object.keys(env)) {
    if (valueOf(env, key) && VERCEL_FORBIDDEN_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      addIssue(issues, key, "forbidden_in_runtime");
    }
  }

  return issues;
}

export function buildVercelRuntimeEnv(localEnv, options = {}) {
  const appUrl = String(options.appUrl ?? localEnv.PRODUCTION_BASE_URL ?? "").trim();
  const runtime = {};

  for (const key of VERCEL_REQUIRED_KEYS) {
    runtime[key] = key === "NEXT_PUBLIC_APP_URL" ? appUrl : valueOf(localEnv, key);
  }

  for (const key of VERCEL_OPTIONAL_KEYS) {
    const value = valueOf(localEnv, key);
    if (value) runtime[key] = value;
  }

  return runtime;
}

export function listPresentLocalOnlyKeys(localEnv) {
  return LOCAL_ONLY_KEYS.filter((key) => valueOf(localEnv, key));
}
