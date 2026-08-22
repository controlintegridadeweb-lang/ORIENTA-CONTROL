#!/usr/bin/env node
/**
 * Grava as chaves do Supabase local em `.env.local` para Next.js e Playwright.
 * Quando GITHUB_ENV está definido, também exporta as mesmas variáveis ao job.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runSupabase } from "../shared/supabase-cli-path.mjs";

const root = process.cwd();
const status = runSupabase(["status", "-o", "env"], {
  cwd: root,
  stdio: "pipe",
});

if (status.status !== 0) {
  if (status.stdout) process.stdout.write(status.stdout);
  if (status.stderr) process.stderr.write(status.stderr);
  console.error("supabase status falhou; a stack local precisa estar em execução.");
  process.exit(status.status ?? 1);
}

const parsed = parseEnvOutput(status.stdout ?? "");
const apiUrl = required(parsed, "API_URL");
const anonKey = required(parsed, "ANON_KEY");
const serviceRoleKey = required(parsed, "SERVICE_ROLE_KEY");
const databaseUrl =
  parsed.DB_URL ??
  parsed.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3002";

const envLines = [
  `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
  `NEXT_PUBLIC_APP_URL=${appUrl}`,
  `DATABASE_URL=${databaseUrl}`,
];

writeFileSync(resolve(root, ".env.local"), `${envLines.join("\n")}\n`, "utf8");

const githubEnv = process.env.GITHUB_ENV?.trim();
if (githubEnv) {
  writeFileSync(githubEnv, `${envLines.join("\n")}\n`, { encoding: "utf8", flag: "a" });
}

console.log("Ambiente local do Supabase gravado em .env.local.");

function parseEnvOutput(output) {
  const values = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
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

function required(values, key) {
  const value = values[key];
  if (!value) {
    throw new Error(`supabase status não devolveu ${key}.`);
  }
  return value;
}
