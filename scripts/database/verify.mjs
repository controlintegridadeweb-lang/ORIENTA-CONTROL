#!/usr/bin/env node
/**
 * Verificações de integração contra PostgreSQL real.
 *
 * Requer DATABASE_URL de um banco descartável (Supabase local após
 * `supabase db reset --local`, ou PostgreSQL efêmero). As fixtures usam a
 * role da URL — no stack local, `postgres` da instância de desenvolvimento.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const migrationsDir = join(root, "supabase", "migrations");
const verifyDir = join(root, "supabase", "verify");

const DB = process.env.DATABASE_URL?.trim();
const verifyOnly = process.env.DB_VERIFY_ONLY === "1";

if (!DB) {
  console.error("Defina DATABASE_URL para um banco de teste descartável.");
  process.exit(2);
}

async function executeSql(sql) {
  const client = new pg.Client({ connectionString: DB });
  const notices = [];
  client.on("notice", (message) => {
    notices.push(message.message ?? String(message));
  });
  await client.connect();
  try {
    const result = await client.query(sql);
    return { notices, result };
  } finally {
    await client.end();
  }
}

async function runSql(label, sql) {
  try {
    const { notices } = await executeSql(sql);
    return notices.join("\n");
  } catch (error) {
    console.error(`✗ ${label}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runFile(label, filePath) {
  return runSql(label, readFileSync(filePath, "utf8"));
}

if (!verifyOnly) {
  const preamble = `
do $$ begin if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz default now());
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select case
    when strpos(name, '/') = 0 then array[]::text[]
    else string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
  end
$$;
`;
  await runSql("preâmbulo (stubs auth/storage)", preamble);

  const migrations = readdirSync(migrationsDir)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  for (const migration of migrations) {
    await runFile(`migration ${migration}`, join(migrationsDir, migration));
  }
  console.log(`✓ ${migrations.length} migrations aplicadas`);
} else {
  console.log("✓ DB_VERIFY_ONLY=1: usando schema real já aplicado pelo Supabase local");
}

const seeds = readdirSync(verifyDir)
  .filter((file) => file.startsWith("_") && file.endsWith(".sql"))
  .sort();
for (const seed of seeds) {
  await runFile(`seed ${seed}`, join(verifyDir, seed));
}

const checks = readdirSync(verifyDir)
  .filter((file) => file.endsWith(".sql") && !file.startsWith("_"))
  .sort();
let ok = 0;
for (const check of checks) {
  const out = await runFile(`verify ${check}`, join(verifyDir, check));
  const okLine = out.split("\n").find((line) => /:\s*OK/.test(line));
  console.log(`✓ ${check}${okLine ? "  — " + okLine.replace(/^.*NOTICE:\s*/, "").trim() : ""}`);
  ok += 1;
}
console.log(`\nIntegração: ${ok} verificações passaram.`);
