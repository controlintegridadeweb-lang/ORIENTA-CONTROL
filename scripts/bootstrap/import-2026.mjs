#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const dataDir = resolve(root, "data/bootstrap-2026/private");
const manifestPath = resolve(dataDir, "manifest.json");
const credentialsDir = resolve(root, "var/bootstrap");
const credentialsPath = resolve(credentialsDir, "bootstrap-2026-users.credentials.csv");
const dryRun = process.argv.includes("--dry-run");

loadEnv();

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = supabaseProjectRef();

if (!existsSync(manifestPath)) {
  throw new Error(`Bootstrap 2026 ausente: ${manifestPath}`);
}
if (!dryRun && (!projectUrl || !serviceRoleKey || !projectRef)) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para o projeto de destino.",
  );
}
if (!accessToken && !dryRun) {
  throw new Error(
    "Defina SUPABASE_ACCESS_TOKEN para importar os dados via Management API (HTTPS).",
  );
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function readJsonl(relativePath) {
  const path = resolve(dataDir, relativePath);
  const content = readFileSync(path, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256File(relativePath) {
  const bytes = readFileSync(resolve(dataDir, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

function verifyDataset() {
  const issues = [];
  for (const [file, expected] of Object.entries(manifest.files)) {
    const path = resolve(dataDir, file);
    if (!existsSync(path)) {
      issues.push(`${file}: arquivo ausente`);
      continue;
    }
    const rows = readJsonl(file);
    if (rows.length !== expected.rows) {
      issues.push(`${file}: ${rows.length} linhas; esperado ${expected.rows}`);
    }
    const digest = sha256File(file);
    if (digest !== expected.sha256) {
      issues.push(`${file}: checksum divergente`);
    }
  }
  if (issues.length > 0) {
    throw new Error(`Bootstrap 2026 inválido:\n- ${issues.join("\n- ")}`);
  }
  assertUserReferencesCovered();
}

function assertUserReferencesCovered() {
  const sourceUserIds = new Set(readJsonl("auth/users.jsonl").map((user) => user.id));
  const issues = [];
  for (const [table, file] of tablePlan) {
    const declared = new Set(userReferenceColumns[table] ?? []);
    const seen = new Set();
    for (const row of readJsonl(file)) {
      for (const [column, value] of Object.entries(row)) {
        if (typeof value === "string" && sourceUserIds.has(value)) {
          seen.add(column);
        }
      }
    }
    for (const column of seen) {
      if (!declared.has(column)) {
        issues.push(`${table}.${column}`);
      }
    }
  }
  if (issues.length > 0) {
    throw new Error(
      `Bootstrap 2026 inválido: colunas de usuário sem remap após reconciliação Auth:\n- ${issues.join("\n- ")}`,
    );
  }
}

async function managementQuery(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Management API HTTP ${response.status}: ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function dollarQuote(value) {
  let tag = "$bootstrap$";
  let suffix = 0;
  while (value.includes(tag)) {
    suffix += 1;
    tag = `$bootstrap${suffix}$`;
  }
  return `${tag}${value}${tag}`;
}

const primaryKeys = {
  organizations: ["id"],
  axes: ["id"],
  sections: ["id"],
  questions: ["id"],
  question_versions: ["id"],
  question_library_binding: ["question_id"],
  forms: ["id"],
  form_drafts: ["id"],
  form_draft_questions: ["form_draft_id", "question_id"],
  form_versions: ["id"],
  form_questions: ["form_version_id", "question_version_id"],
  form_assignments: ["id"],
  form_periods: ["id"],
  profiles: ["user_id"],
  respondent_profile_details: ["id"],
  cycles: ["id"],
  responses: ["id"],
  evidences: ["id"],
};

const userReferenceColumns = {
  sections: ["created_by", "updated_by", "approved_by", "deprecated_by"],
  question_library_binding: ["updated_by"],
  forms: ["created_by"],
  form_versions: ["published_by"],
  form_assignments: ["assigned_by"],
  profiles: ["user_id"],
  respondent_profile_details: ["user_id", "updated_by"],
  responses: [
    "na_validated_by",
    "created_by",
    "admin_na_decided_by",
    "admin_proof_decided_by",
  ],
  evidences: ["validated_by", "submitted_by"],
};

const deferredForeignKeys = {
  forms: ["current_form_version_id"],
};

const tablePlan = [
  ["organizations", "cadastro/organizations.jsonl"],
  ["axes", "formulario/axes.jsonl"],
  ["sections", "formulario/sections.jsonl"],
  ["questions", "formulario/questions.jsonl"],
  ["question_versions", "formulario/question_versions.jsonl"],
  ["question_library_binding", "formulario/question_library_binding.jsonl"],
  ["forms", "formulario/forms.jsonl"],
  ["form_drafts", "formulario/form_drafts.jsonl"],
  ["form_draft_questions", "formulario/form_draft_questions.jsonl"],
  ["form_versions", "formulario/form_versions.jsonl"],
  ["form_questions", "formulario/form_questions.jsonl"],
  ["form_assignments", "formulario/form_assignments.jsonl"],
  ["form_periods", "formulario/form_periods.jsonl"],
  ["profiles", "cadastro/profiles.jsonl"],
  ["respondent_profile_details", "cadastro/respondent_profile_details.jsonl"],
  ["cycles", "diagnostico/cycles.jsonl"],
  ["responses", "diagnostico/responses.jsonl"],
  ["evidences", "diagnostico/evidences.jsonl"],
];

function nullDeferredForeignKeys(table, rows) {
  const columns = deferredForeignKeys[table];
  if (!columns) return rows;
  return rows.map((source) => {
    const row = { ...source };
    for (const column of columns) row[column] = null;
    return row;
  });
}

function remapUserReferences(table, rows, userMap) {
  const columns = userReferenceColumns[table] ?? [];
  return rows.map((source) => {
    const row = { ...source };
    for (const column of columns) {
      const oldId = row[column];
      if (!oldId) continue;
      const newId = userMap.get(oldId);
      if (!newId) {
        throw new Error(`${table}.${column}: usuário ${oldId} não reconciliado`);
      }
      row[column] = newId;
    }
    return row;
  });
}

async function reconcileAuthUsers() {
  const sourceUsers = readJsonl("auth/users.jsonl");
  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userMap = new Map();
  const existingByEmail = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) existingByEmail.set(user.email.toLowerCase(), user);
    }
    if (data.users.length < 1000) break;
    page += 1;
  }

  const generatedCredentials = [];
  for (const sourceUser of sourceUsers) {
    const email = sourceUser.email?.trim().toLowerCase();
    if (!email) throw new Error(`Usuário Auth sem e-mail: ${sourceUser.id}`);
    const existing = existingByEmail.get(email);
    if (existing) {
      userMap.set(sourceUser.id, existing.id);
      continue;
    }
    if (dryRun) {
      userMap.set(sourceUser.id, sourceUser.id);
      continue;
    }
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: Boolean(sourceUser.email_confirmed_at),
    });
    if (error || !data.user) {
      throw error ?? new Error(`Não foi possível criar ${email}`);
    }
    userMap.set(sourceUser.id, data.user.id);
    existingByEmail.set(email, data.user);
    generatedCredentials.push({ email, password });
  }

  if (generatedCredentials.length > 0) {
    mkdirSync(credentialsDir, { recursive: true });
    const csv = [
      "email,temporary_password",
      ...generatedCredentials.map(
        ({ email, password }) => `"${email.replaceAll('"', '""')}","${password}"`,
      ),
      "",
    ].join("\n");
    writeFileSync(credentialsPath, csv, { encoding: "utf8", mode: 0o600 });
  }

  return { userMap, generatedCredentials };
}

async function importChunk(table, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const pks = primaryKeys[table];
  const updateColumns = columns.filter((column) => !pks.includes(column));
  const columnSql = columns.map(quoteIdentifier).join(", ");
  const selectSql = columns
    .map((column) => `payload.${quoteIdentifier(column)}`)
    .join(", ");
  const conflictSql = pks.map(quoteIdentifier).join(", ");
  const updateSql = updateColumns.length
    ? `do update set ${updateColumns
        .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
        .join(", ")}`
    : "do nothing";
  const json = dollarQuote(JSON.stringify(rows));
  const sql = `
    begin;
    alter table public.${quoteIdentifier(table)} disable trigger user;
    with payload as (
      select * from jsonb_populate_recordset(null::public.${quoteIdentifier(table)}, ${json}::jsonb)
    )
    insert into public.${quoteIdentifier(table)} (${columnSql})
    select ${selectSql} from payload
    on conflict (${conflictSql}) ${updateSql};
    alter table public.${quoteIdentifier(table)} enable trigger user;
    commit;
  `;
  await managementQuery(sql);
}

async function verifyRemoteCounts() {
  const checks = tablePlan.map(([table, file]) => ({
    table,
    expected: readJsonl(file).length,
  }));
  const sql = checks
    .map(
      ({ table }) =>
        `select '${table}' as table_name, count(*)::bigint as rows from public.${quoteIdentifier(table)}`,
    )
    .join(" union all ");
  const rows = await managementQuery(sql);
  const actual = new Map((rows ?? []).map((row) => [row.table_name, Number(row.rows)]));
  const problems = checks.filter(({ table, expected }) => actual.get(table) < expected);
  if (problems.length > 0) {
    throw new Error(
      `Validação remota falhou: ${problems
        .map(({ table, expected }) => `${table} < ${expected}`)
        .join(", ")}`,
    );
  }
}

verifyDataset();
console.log(`Bootstrap: ${manifest.dataset}`);
console.log(`Projeto de destino: ${projectRef ?? "não utilizado no dry-run"}`);
console.log(`Modo: ${dryRun ? "validação local" : "importação HTTPS"}`);

if (dryRun) {
  console.log("✓ Arquivos, contagens e checksums válidos.");
  console.log(`✓ ${manifest.summary.responses} respostas e ${manifest.summary.evidences} evidências prontas.`);
  process.exit(0);
}

const { userMap, generatedCredentials } = await reconcileAuthUsers();
console.log(`✓ Auth reconciliado: ${userMap.size} usuários.`);

const chunkSize = 250;

async function importTable(table, rows) {
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    await importChunk(table, rows.slice(offset, offset + chunkSize));
  }
}

for (const [table, file] of tablePlan) {
  const sourceRows = readJsonl(file);
  const rows = nullDeferredForeignKeys(table, remapUserReferences(table, sourceRows, userMap));
  await importTable(table, rows);
  console.log(`✓ ${table}: ${rows.length}`);
}

for (const [table, file] of tablePlan) {
  const columns = deferredForeignKeys[table];
  if (!columns) continue;
  const rows = remapUserReferences(table, readJsonl(file), userMap);
  await importTable(table, rows);
  console.log(`✓ ${table} (${columns.join(", ")}): FK circular resolvida.`);
}

await verifyRemoteCounts();
console.log("✓ Validação remota concluída.");
if (generatedCredentials.length > 0) {
  console.log(`Credenciais temporárias criadas em: ${credentialsPath}`);
  console.log("Esse arquivo é local, sensível e está ignorado pelo Git.");
}
console.log("Bootstrap 2026 concluído.");
