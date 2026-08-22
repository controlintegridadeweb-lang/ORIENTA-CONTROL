import "server-only";

export type ProductionConfigurationIssue = {
  key: string;
  code:
    | "missing"
    | "invalid_url"
    | "insecure_url"
    | "invalid_value"
    | "weak_secret"
    | "placeholder"
    | "forbidden"
    | "mismatched_pair"
    | "duplicate_secret";
};

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "HEALTHCHECK_SECRET",
] as const;

const FORBIDDEN_PRODUCTION_PREFIXES = ["E2E_", "ORIENTA_SOURCE_", "ORIENTA_TARGET_"] as const;
const FORBIDDEN_PRODUCTION_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "ORIENTA_RESPONDENT_INITIAL_PASSWORD",
] as const;
const PLACEHOLDER = /(?:coloque_|example|exemplo|changeme|replace_me|your[_-]|seu-dominio|localhost)/i;
const valueOf = (env: NodeJS.ProcessEnv, key: string) => env[key]?.trim() ?? "";

function isHttpsUrl(raw: string, originOnly: boolean): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" &&
      (!originOnly || (parsed.pathname === "/" && parsed.search === "" && parsed.hash === ""));
  } catch {
    return false;
  }
}

function addSecretIssues(issues: ProductionConfigurationIssue[], env: NodeJS.ProcessEnv, key: string, minimumLength: number) {
  const value = valueOf(env, key);
  if (!value) return;
  if (PLACEHOLDER.test(value)) issues.push({ key, code: "placeholder" });
  if (value.length < minimumLength) issues.push({ key, code: "weak_secret" });
  if (/\s/.test(value)) issues.push({ key, code: "invalid_value" });
}

export function collectProductionConfigurationIssues(env: NodeJS.ProcessEnv = process.env): ProductionConfigurationIssue[] {
  const issues: ProductionConfigurationIssue[] = [];
  for (const key of REQUIRED_KEYS) if (!valueOf(env, key)) issues.push({ key, code: "missing" });

  for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
    const value = valueOf(env, key);
    if (!value) continue;
    if (!isHttpsUrl(value, true)) {
      let code: ProductionConfigurationIssue["code"] = "invalid_url";
      try { if (new URL(value).protocol !== "https:") code = "insecure_url"; } catch { /* invalid_url */ }
      issues.push({ key, code });
    }
    if (PLACEHOLDER.test(value)) issues.push({ key, code: "placeholder" });
  }

  addSecretIssues(issues, env, "NEXT_PUBLIC_SUPABASE_ANON_KEY", 32);
  addSecretIssues(issues, env, "SUPABASE_SERVICE_ROLE_KEY", 32);
  addSecretIssues(issues, env, "CRON_SECRET", 32);
  addSecretIssues(issues, env, "HEALTHCHECK_SECRET", 32);

  const anonKey = valueOf(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRole = valueOf(env, "SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = valueOf(env, "CRON_SECRET");
  const healthSecret = valueOf(env, "HEALTHCHECK_SECRET");
  if (anonKey && serviceRole && anonKey === serviceRole) issues.push({ key: "SUPABASE_SERVICE_ROLE_KEY", code: "duplicate_secret" });
  if (cronSecret && healthSecret && cronSecret === healthSecret) issues.push({ key: "HEALTHCHECK_SECRET", code: "duplicate_secret" });

  const webhookUrl = valueOf(env, "NOTIFICATION_WEBHOOK_URL");
  const webhookSecret = valueOf(env, "NOTIFICATION_WEBHOOK_SECRET");
  if (Boolean(webhookUrl) !== Boolean(webhookSecret)) issues.push({ key: webhookUrl ? "NOTIFICATION_WEBHOOK_SECRET" : "NOTIFICATION_WEBHOOK_URL", code: "mismatched_pair" });
  if (webhookUrl && !isHttpsUrl(webhookUrl, false)) issues.push({ key: "NOTIFICATION_WEBHOOK_URL", code: "invalid_url" });
  if (webhookSecret) addSecretIssues(issues, env, "NOTIFICATION_WEBHOOK_SECRET", 24);

  for (const key of FORBIDDEN_PRODUCTION_KEYS) if (valueOf(env, key)) issues.push({ key, code: "forbidden" });
  for (const key of Object.keys(env)) {
    if (valueOf(env, key) && FORBIDDEN_PRODUCTION_PREFIXES.some((prefix) => key.startsWith(prefix))) issues.push({ key, code: "forbidden" });
  }

  return issues.filter((issue, index, all) => all.findIndex((candidate) => candidate.key === issue.key && candidate.code === issue.code) === index);
}
