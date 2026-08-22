#!/usr/bin/env node
/**
 * Aplica migrations via Management API (HTTPS), quando a porta 5432 está bloqueada.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:push:api
 *
 * Token: https://supabase.com/dashboard/account/tokens
 *
 * A API remota grava `version` com precisão de segundo
 * (`to_char(current_timestamp, 'YYYYMMDDHHMISS')`). Por isso:
 * - listamos o histórico e pulamos nomes já aplicados;
 * - esperamos ≥1,1s entre aplicações para evitar PK duplicada.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const MIN_INTERVAL_MS = 1100;

loadEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = supabaseProjectRef();

if (!token) {
  console.error(
    "Defina SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).",
  );
  process.exit(1);
}

if (!projectRef) {
  console.error("NEXT_PUBLIC_SUPABASE_URL deve apontar para um projeto .supabase.co.");
  process.exit(1);
}

const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

function normalizeAppliedEntry(row) {
  if (typeof row === "string") return [row, row.replace(/\.sql$/, "")];
  const version = String(row.version ?? "").trim();
  const name = String(row.name ?? "").trim();
  const keys = new Set();
  if (name) {
    keys.add(name);
    keys.add(`${name}.sql`);
    // API histórica: version="0001", name="extensoes_enums_tipos"
    // arquivo local: migration SQL timestampada
    if (version && !name.startsWith(`${version}_`)) {
      keys.add(`${version}_${name}`);
      keys.add(`${version}_${name}.sql`);
    }
  }
  if (version) keys.add(version);
  return [...keys];
}

async function listAppliedNames() {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Listar migrations: HTTP ${response.status} — ${body}`);
  }
  const rows = JSON.parse(body);
  const applied = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const key of normalizeAppliedEntry(row)) applied.add(key);
  }
  return applied;
}

async function applyMigration(file) {
  const query = readFileSync(resolve(migrationsDir, file), "utf8");
  const name = file.replace(/\.sql$/, "");

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, name }),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${file}: HTTP ${response.status} — ${body}`);
  }

  console.log(`✓ ${file}`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

console.log(`Projeto: ${projectRef}`);

const applied = await listAppliedNames();
const pending = migrations.filter((file) => {
  const name = file.replace(/\.sql$/, "");
  const version = name.slice(0, 4);
  if (
    applied.has(name) ||
    applied.has(file) ||
    applied.has(version) ||
    applied.has(name.slice(5))
  ) {
    console.log(`↷ ${file} (já aplicada)`);
    return false;
  }
  return true;
});

console.log(`Aplicando ${pending.length} de ${migrations.length} migrations via Management API…\n`);

for (const [index, file] of pending.entries()) {
  if (index > 0) await sleep(MIN_INTERVAL_MS);
  await applyMigration(file);
}

console.log("\nConcluído.");
