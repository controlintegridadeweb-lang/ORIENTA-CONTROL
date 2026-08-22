#!/usr/bin/env node
/**
 * Aplica migrations locais no Supabase remoto via `supabase db push`.
 *
 * Uso: npm run db:push
 *
 * Credenciais (em .env.local):
 *   SUPABASE_DB_URL — connection string completa (recomendado), ou
 *   SUPABASE_DB_PASSWORD — senha do Postgres + NEXT_PUBLIC_SUPABASE_URL
 *
 * Alternativa: `npx supabase login` + `npm run db:link` + `npx supabase db push`
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, resolveDbUrl, supabaseProjectRef } from "../shared/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

loadEnv();

const dbUrl = resolveDbUrl();
const projectRef = supabaseProjectRef();

if (!dbUrl) {
  console.error(`
Não foi possível montar a URL do Postgres.

Adicione em .env.local uma das opções:

  SUPABASE_DB_URL=postgresql://postgres:[SENHA]@db.[project-ref].supabase.co:5432/postgres

ou

  SUPABASE_DB_PASSWORD=[SENHA]
  NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co

A senha está em: Supabase Dashboard → Project Settings → Database → Database password.

Alternativa com CLI linkada:
  npx supabase login
  npm run db:link
  npx supabase db push
`);
  process.exit(1);
}

console.log(`Projeto: ${projectRef ?? "(ref desconhecido)"}`);
console.log("Aplicando migrations com supabase db push…\n");

const args = ["supabase", "db", "push", "--db-url", dbUrl, "--yes"];
const result = spawnSync("npx", args, {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
