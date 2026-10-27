import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

export function parseEnvText(content) {
  const values = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

/** Lê um arquivo de ambiente sem gravá-lo em process.env. */
export function readIsolatedEnv(fileName) {
  const path = resolve(root, fileName);
  if (!existsSync(path)) return null;
  return parseEnvText(readFileSync(path, "utf8"));
}

/** Carrega .env.local e .env (sem sobrescrever variáveis já definidas). */
export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const parsed = readIsolatedEnv(name);
    if (!parsed) continue;
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] !== undefined) continue;
      process.env[key] = value;
    }
  }
}

/** Extrai project-ref de NEXT_PUBLIC_SUPABASE_URL. */
export function supabaseProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
}

/**
 * URL Postgres para CLI/scripts.
 * Preferência: SUPABASE_DB_URL → DATABASE_URL → montada com SUPABASE_DB_PASSWORD.
 */
export function resolveDbUrl() {
  const direct =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = supabaseProjectRef();
  if (password && ref) {
    const region = process.env.SUPABASE_DB_REGION ?? "sa-east-1";
    const user = `postgres.${ref}`;
    // O host do pooler muda por projeto: o prefixo (aws-0/aws-1) depende da data
    // de provisionamento. O valor exato está em Dashboard → Project Settings →
    // Database → Connection pooling. Por isso é configurável:
    //   SUPABASE_DB_POOLER_HOST   — host completo (override total), ou
    //   SUPABASE_DB_POOLER_PREFIX — só o prefixo (default aws-1) + região.
    const prefix = process.env.SUPABASE_DB_POOLER_PREFIX ?? "aws-1";
    const host =
      process.env.SUPABASE_DB_POOLER_HOST ??
      `${prefix}-${region}.pooler.supabase.com`;
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:5432/postgres`;
  }

  return null;
}
