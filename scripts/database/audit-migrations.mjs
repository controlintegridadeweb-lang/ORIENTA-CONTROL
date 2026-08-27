import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const directory = join(root, "supabase", "migrations");
const canonicalBaselineFiles = [
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
];
const files = readdirSync(directory).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(
  JSON.stringify(files.slice(0, canonicalBaselineFiles.length)) === JSON.stringify(canonicalBaselineFiles),
  `As 10 migrations da baseline canônica devem permanecer imutáveis e nas primeiras posições. Encontradas: ${files.join(", ")}`,
);
assert(files.length >= canonicalBaselineFiles.length, "A baseline canônica não pode perder migrations.");
for (const file of files.slice(canonicalBaselineFiles.length)) {
  assert(file > canonicalBaselineFiles.at(-1), `Migration evolutiva fora de ordem: ${file}`);
}

const baselineSet = new Set(canonicalBaselineFiles);
let allSql = "";
const functionOwners = new Map();
const tableOwners = new Map();
const viewOwners = new Map();
const policyOwners = new Map();
const triggerOwners = new Map();
const dataApiFunctions = new Set();
const baselineFunctionOwners = new Map();
const baselineTableOwners = new Map();
const baselineViewOwners = new Map();
const baselinePolicyOwners = new Map();
const baselineTriggerOwners = new Map();

function register(map, key, file) {
  map.set(key, [...(map.get(key) ?? []), file]);
}

for (const file of files) {
  const source = readFileSync(join(directory, file), "utf8");
  const isBaseline = baselineSet.has(file);
  allSql += `\n${source}`;
  assert(source.trim().length > 20, `${file} está vazia.`);
  assert(!/â€|Ã[§£¡©ª³µ­º]/.test(source), `${file} contém mojibake.`);
  assert(!/\b(fix|patch|backfill|correction|legacy migration)\b/i.test(file), `${file} possui nome corretivo/legado.`);

  // Apenas a baseline deve nascer diretamente no estado final. Evoluções pós-baseline
  // podem alterar schema e substituir funções de forma incremental e auditável.
  if (isBaseline) {
    assert(!/alter\s+type\s+public\.[a-z0-9_]+\s+add\s+value/gi.test(source), `${file} contém ALTER TYPE ADD VALUE; enum da baseline deve nascer no estado final.`);
    if (file !== "20260812000300_relations.sql") {
      assert(!/alter\s+table\s+public\.[a-z0-9_]+[\s\S]{0,500}?\b(add\s+column|drop\s+column|alter\s+column|drop\s+constraint|add\s+constraint)\b/gi.test(source), `${file} contém evolução estrutural ALTER TABLE dentro da baseline.`);
    } else {
      assert(!/\b(add\s+column|drop\s+column|alter\s+column|drop\s+constraint)\b/gi.test(source), `${file} deve conter somente FKs/UNIQUE necessários para fechar dependências circulares.`);
    }
    assert(!/drop\s+function\s+if\s+exists\s+public\./gi.test(source), `${file} contém DROP FUNCTION de overload legado dentro da baseline.`);
  }

  for (const match of source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(public|app_private)\.([a-z0-9_]+)/gi)) {
    const schema = match[1].toLowerCase();
    const functionName = match[2].toLowerCase();
    const name = `${schema}.${functionName}`;
    register(functionOwners, name, file);
    if (isBaseline) register(baselineFunctionOwners, name, file);

    if (schema === "public") {
      const languageIndex = source.toLowerCase().indexOf("\nlanguage ", match.index);
      const declaration = source.slice(
        match.index,
        languageIndex >= 0 ? languageIndex : Math.min(source.length, match.index + 4000),
      );
      if (!/\breturns\s+trigger\b/i.test(declaration)) {
        dataApiFunctions.add(functionName);
      }
    }
  }
  for (const match of source.matchAll(/create\s+table\s+public\.([a-z0-9_]+)/gi)) {
    const name = match[1].toLowerCase();
    register(tableOwners, name, file);
    if (isBaseline) register(baselineTableOwners, name, file);
  }
  for (const match of source.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.([a-z0-9_]+)/gi)) {
    const name = match[1].toLowerCase();
    register(viewOwners, name, file);
    if (isBaseline) register(baselineViewOwners, name, file);
  }
  for (const match of source.matchAll(/create\s+policy\s+(.+?)\s+on\s+(?:public|storage)\.([a-z0-9_]+)/gi)) {
    const key = `${match[2].toLowerCase()}:${match[1].replace(/\s+/g, " ").trim().toLowerCase()}`;
    register(policyOwners, key, file);
    if (isBaseline) register(baselinePolicyOwners, key, file);
  }
  for (const match of source.matchAll(/create\s+trigger\s+([a-z0-9_]+)[\s\S]*?\s+on\s+(public|storage|auth)\.([a-z0-9_]+)/gi)) {
    const key = `${match[2].toLowerCase()}.${match[3].toLowerCase()}:${match[1].toLowerCase()}`;
    register(triggerOwners, key, file);
    if (isBaseline) register(baselineTriggerOwners, key, file);
  }
}

const duplicates = (map) => [...map].filter(([, owners]) => owners.length > 1).map(([key, owners]) => `${key}: ${owners.join(", ")}`);
assert(duplicates(baselineFunctionOwners).length === 0, `Funções duplicadas dentro da baseline: ${duplicates(baselineFunctionOwners).join("; ")}`);
assert(duplicates(baselineTableOwners).length === 0, `Tabelas duplicadas dentro da baseline: ${duplicates(baselineTableOwners).join("; ")}`);
assert(duplicates(baselineViewOwners).length === 0, `Views duplicadas dentro da baseline: ${duplicates(baselineViewOwners).join("; ")}`);
assert(duplicates(baselinePolicyOwners).length === 0, `Policies duplicadas dentro da baseline: ${duplicates(baselinePolicyOwners).join("; ")}`);
assert(duplicates(baselineTriggerOwners).length === 0, `Triggers duplicados dentro da baseline: ${duplicates(baselineTriggerOwners).join("; ")}`);

// CREATE TABLE/POLICY/TRIGGER repetido entre migrations não é uma evolução segura: ao
// contrário de CREATE OR REPLACE FUNCTION/VIEW, falha em instalação sequencial.
assert(duplicates(tableOwners).length === 0, `Tabelas recriadas entre migrations: ${duplicates(tableOwners).join("; ")}`);
assert(duplicates(policyOwners).length === 0, `Policies recriadas entre migrations: ${duplicates(policyOwners).join("; ")}`);
assert(duplicates(triggerOwners).length === 0, `Triggers recriados entre migrations: ${duplicates(triggerOwners).join("; ")}`);

assert(tableOwners.size === 61, `Esperadas 61 tabelas públicas finais; encontradas ${tableOwners.size}.`);
assert(functionOwners.size === 203, `Esperadas 203 funções de aplicação conhecidas após as evoluções atuais; encontradas ${functionOwners.size}.`);
assert(viewOwners.size === 6, `Esperadas 6 views públicas finais; encontradas ${viewOwners.size}.`);
assert(triggerOwners.size === 96, `Esperados 96 triggers finais; encontrados ${triggerOwners.size}.`);

// Todo RPC/função SQL pública que não retorna trigger deve existir no contrato
// versionado usado pela aplicação. Assim o job de quality detecta drift de
// database.types.ts antes de precisar subir Docker/Supabase local.
const databaseTypesSource = readFileSync(
  join(root, "src", "infrastructure", "supabase", "database.types.ts"),
  "utf8",
);
const missingDataApiFunctions = [...dataApiFunctions]
  .filter((name) => !new RegExp(`\\n\\s{6}${name}:`).test(databaseTypesSource))
  .sort();
assert(
  missingDataApiFunctions.length === 0,
  `database.types.ts não representa funções públicas do schema: ${missingDataApiFunctions.join(", ")}`,
);

const compact = allSql.replace(/\s+/g, " ").toLowerCase();
const requirements = [
  "create type public.evidence_kind as enum",
  "'file', 'link'",
  "'text'",
  "fami_policy_version text not null default 'v7'",
  "fami_policy_version in ('v3', 'v4', 'v5', 'v6', 'v7')",
  "yes_with_approved_evidence_weight numeric(6,3) not null default 2",
  "when has_approved_evidence then 2::numeric",
  "else 0::numeric",
  "create table public.fami_preliminary_processings",
  "methodology_version text not null default 'prelim_v1'",
  "create table public.validation_analysis_drafts",
  "create table public.form_periods",
  "file_validation_status text not null default 'not_applicable'",
  "start_date date not null",
  "progress_percentage integer not null default 0",
  "create or replace function public.save_respondent_action_plan",
  "create table public.action_plan_deadline_change_requests",
  "create or replace function public.request_action_plan_deadline_change",
  "create or replace function public.decide_action_plan_deadline_change",
  "create or replace function public.guard_action_plan_due_date_change",
  "create or replace function public.guard_action_plan_progress_monotonic",
  "action_plan_progress_cannot_decrease",
  "create schema if not exists app_private",
  "create or replace function app_private.is_admin",
  "create or replace function public.materialize_fami_preliminary",
  "a existência do membro não depende desse join",
  "insert into storage.buckets (id, name, public, file_size_limit) values ('evidencias', 'evidencias', false, 20971520)",
  "insert into storage.buckets (id, name, public, file_size_limit) values ('planos-acao', 'planos-acao', false, 20971520)",
  "insert into storage.buckets (id, name, public) values ('relatorios', 'relatorios', false)",
  "alter table storage.objects enable row level security",
  "notify pgrst, 'reload schema'",
];
for (const requirement of requirements) assert(compact.includes(requirement), `Contrato ausente: ${requirement}`);

assert(!compact.includes("malware_scan_status"), "Schema ainda contém coluna legada malware_scan_status.");
assert(!compact.includes("fami_policy_version set default 'v6'"), "Schema ainda contém transição obsoleta para política FAMI v6.");
assert(!canonicalBaselineFiles.some((file) => readFileSync(join(directory, file), "utf8").toLowerCase().includes("alter type public.evidence_kind add value")), "Baseline ainda contém evolução do enum evidence_kind.");

if (failures.length) {
  console.error("Auditoria de migrations falhou:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Schema ORIENTA aprovado: ${canonicalBaselineFiles.length} migrations imutáveis da baseline + ${files.length - canonicalBaselineFiles.length} evolução(ões); ${tableOwners.size} tabelas, ${functionOwners.size} funções conhecidas, ${viewOwners.size} views e ${triggerOwners.size} triggers.`);
