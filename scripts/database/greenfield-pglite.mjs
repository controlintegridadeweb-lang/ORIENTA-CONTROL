/**
 * Aplica a baseline greenfield consolidada em PGlite (Postgres embutido
 * descartável). Se houver token/ref remoto, compara o inventário de schema.
 *
 * Uso: node scripts/database/greenfield-pglite.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const migDir = path.join(root, "supabase/migrations");

loadEnv();
const ref = supabaseProjectRef();
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function remoteQuery(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await r.text();
  if (!r.ok) throw new Error(`remote ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const PREAMBLE = `
create schema if not exists extensions;
grant usage on schema extensions to public;
create extension if not exists pgcrypto with schema extensions;
set search_path to public, extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz default now()
);
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select case
    when strpos(name, '/') = 0 then array[]::text[]
    else string_to_array(regexp_replace(name, '/[^/]*$', ''), '/')
  end
$$;
`;

async function inventory(db) {
  const tables = await db.query(`
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
    order by 1
  `);
  const columns = await db.query(`
    select table_name || '.' || column_name || ':' || data_type as col
    from information_schema.columns
    where table_schema='public'
    order by table_name, column_name
  `);
  const funcs = await db.query(`
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
    order by 1
  `);
  const checks = await db.query(`
    select conrelid::regclass::text || ':' || conname as c
    from pg_constraint
    where contype='c' and connamespace='public'::regnamespace
    order by 1
  `);
  const indexes = await db.query(`
    select indexname from pg_indexes where schemaname='public' order by 1
  `);
  const policies = await db.query(`
    select tablename || ':' || policyname as p
    from pg_policies where schemaname='public' order by 1
  `);
  const types = await db.query(`
    select t.typname from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname='public' and t.typtype='e'
    order by 1
  `);
  const views = await db.query(`
    select table_name from information_schema.views
    where table_schema='public' order by 1
  `);
  return {
    tables: tables.rows.map((r) => r.table_name),
    columns: columns.rows.map((r) => r.col),
    funcs: funcs.rows.map((r) => r.sig),
    checks: checks.rows.map((r) => r.c),
    indexes: indexes.rows.map((r) => r.indexname),
    policies: policies.rows.map((r) => r.p),
    enums: types.rows.map((r) => r.typname),
    views: views.rows.map((r) => r.table_name),
  };
}

function setDiff(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  return {
    onlyA: [...A].filter((x) => !B.has(x)).sort(),
    onlyB: [...B].filter((x) => !A.has(x)).sort(),
  };
}

/** Funções de extensão (pgcrypto/pg_trgm) que o PGlite registra em public. */
function isExtensionNoiseFunction(sig) {
  return /^(armor|crypt|dearmor|decrypt|digest|encrypt|fips_mode|gen_random_|gen_salt|hmac|pgp_|gin_|gtrgm_|set_limit|show_limit|show_trgm|similarity|strict_word_similarity|word_similarity)/i.test(
    sig,
  );
}

const files = fs
  .readdirSync(migDir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();

const expectedMigrations = [
  "20260812000100_extensions_types.sql",
  "20260812000200_schema.sql",
  "20260812000300_relations.sql",
  "20260812000400_read_models.sql",
  "20260812000500_functions.sql",
  "20260812000600_triggers.sql",
  "20260812000700_storage.sql",
  "20260812000800_security_rls.sql",
  "20260812000900_comments.sql",
  "20260812001000_contract_checks.sql",
  "20260812001100_action_plan_deadline_change_requests.sql",
  "20260813000100_fami_preliminary_open_period_and_close.sql",
  "20260814000100_action_plan_monitoring_export_fields.sql",
  "20260819000100_repair_cycles_manual_fami_workspace.sql",
  "20260819120000_list_organization_respondents_profiles.sql",
  "20260820120000_action_plan_progress_monotonic.sql",
  "20260821190000_report_closure_emission_integrity.sql",
  "20260822190000_validation_draft_reads_cycle_state.sql",
  "20260824120000_optional_action_plan_execution_evidence.sql",
  "20260824143000_recommendation_status_optional_execution_evidence.sql",
  "20260826120000_bimonthly_tracking_and_prelim_v2.sql",
];
if (JSON.stringify(files) !== JSON.stringify(expectedMigrations)) {
  throw new Error(`Baseline oficial divergente: ${files.join(", ")}`);
}

console.log(`PGlite greenfield: ${files.length} migrations…`);
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
const applied = [];
const failures = [];

try {
  await db.exec(PREAMBLE);
} catch (e) {
  console.error("Preamble failed:", e.message);
  process.exit(1);
}

for (const name of files) {
  const sql = fs.readFileSync(path.join(migDir, name), "utf8");
  try {
    await db.exec(sql);
    applied.push(name);
    console.log(`✓ ${name}`);
  } catch (e) {
    failures.push({ name, error: String(e.message || e).slice(0, 400) });
    console.error(`✗ ${name}`);
    console.error(`  ${String(e.message || e).slice(0, 240)}`);
    // Continue to surface how far we get; stop on first hard failure for fidelity
    break;
  }
}

let green;
try {
  green = await inventory(db);
} catch (e) {
  green = { error: String(e.message || e) };
}

let remote = null;
let comparison = null;
if (token && ref && applied.length === files.length && !green.error) {
  console.log("\nComparando com remoto incremental…");
  try {
    const remoteInv = {
      tables: (
        await remoteQuery(`
        select table_name from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'
        order by table_name`)
      ).map((r) => r.table_name),
      columns: (
        await remoteQuery(`
        select table_name || '.' || column_name || ':' || data_type as col
        from information_schema.columns
        where table_schema='public'
        order by table_name, column_name`)
      ).map((r) => r.col),
      funcs: (
        await remoteQuery(`
        select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' order by 1`)
      ).map((r) => r.sig),
      checks: (
        await remoteQuery(`
        select conrelid::regclass::text || ':' || conname as c
        from pg_constraint
        where contype='c' and connamespace='public'::regnamespace order by 1`)
      ).map((r) => r.c),
      indexes: (
        await remoteQuery(`
        select indexname from pg_indexes where schemaname='public' order by 1`)
      ).map((r) => r.indexname),
      policies: (
        await remoteQuery(`
        select tablename || ':' || policyname as p
        from pg_policies where schemaname='public' order by 1`)
      ).map((r) => r.p),
      enums: (
        await remoteQuery(`
        select t.typname from pg_type t
        join pg_namespace n on n.oid=t.typnamespace
        where n.nspname='public' and t.typtype='e' order by 1`)
      ).map((r) => r.typname),
      views: (
        await remoteQuery(`
        select table_name from information_schema.views
        where table_schema='public' order by 1`)
      ).map((r) => r.table_name),
    };
    remote = {
      counts: Object.fromEntries(
        Object.entries(remoteInv).map(([k, v]) => [k, v.length]),
      ),
    };
    comparison = {};
    let equal = true;
    let domainEqual = true;
    for (const key of Object.keys(green)) {
      if (!Array.isArray(green[key])) continue;
      let left = green[key];
      let right = remoteInv[key];
      if (key === "funcs") {
        left = left.filter((s) => !isExtensionNoiseFunction(s));
        right = right.filter((s) => !isExtensionNoiseFunction(s));
      }
      const d = setDiff(left, right);
      comparison[key] = {
        green: green[key].length,
        remote: remoteInv[key].length,
        comparedGreen: left.length,
        comparedRemote: right.length,
        onlyGreen: d.onlyA.slice(0, 40),
        onlyRemote: d.onlyB.slice(0, 40),
        onlyGreenTotal: d.onlyA.length,
        onlyRemoteTotal: d.onlyB.length,
      };
      if (d.onlyA.length || d.onlyB.length) {
        equal = false;
        domainEqual = false;
      }
    }
    comparison.schemasEqual = equal;
    comparison.domainSchemasEqual = domainEqual;
    comparison.note =
      "Diferenças em funcs de extensão (pgcrypto/pg_trgm) são ignoradas na equivalência de domínio.";
  } catch (e) {
    comparison = { error: String(e.message || e) };
  }
}

const report = {
  testedAt: new Date().toISOString(),
  engine: "pglite",
  migrationCount: files.length,
  appliedCount: applied.length,
  applied,
  failures,
  greenCounts: green.error
    ? green
    : Object.fromEntries(
        Object.entries(green).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.length : v,
        ]),
      ),
  remote,
  comparison,
  verdict:
    failures.length === 0 && comparison?.domainSchemasEqual
      ? "PASS_GREENFIELD_DOMAIN_EQUALS_INCREMENTAL"
      : failures.length === 0 && comparison?.schemasEqual
        ? "PASS_GREENFIELD_EQUALS_INCREMENTAL"
        : failures.length === 0 && comparison
          ? "GREENFIELD_APPLIED_WITH_DIFFS"
          : failures.length === 0
            ? "PASS_BASELINE_APPLIED"
            : "GREENFIELD_APPLY_FAILED",
};

fs.mkdirSync(path.join(root, "var"), { recursive: true });
const outPath = path.join(root, "var/greenfield-pglite-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("\n" + JSON.stringify(report, null, 2));
console.log(`\nRelatório: ${outPath}`);
process.exit(failures.length === 0 ? 0 : 2);
