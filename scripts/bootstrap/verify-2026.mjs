#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const dataDir = resolve(root, "data/bootstrap-2026/private");
const manifestPath = resolve(dataDir, "manifest.json");

if (!existsSync(manifestPath)) throw new Error("data/bootstrap-2026/private/manifest.json ausente");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const issues = [];

function readJsonl(relativePath) {
  const path = resolve(dataDir, relativePath);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        issues.push(`${relativePath}:${index + 1}: JSON inválido`);
        return null;
      }
    })
    .filter(Boolean);
}

for (const [file, expected] of Object.entries(manifest.files)) {
  const path = resolve(dataDir, file);
  if (!existsSync(path)) {
    issues.push(`${file}: ausente`);
    continue;
  }
  const bytes = readFileSync(path);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const rows = bytes.toString("utf8").split("\n").filter(Boolean).length;
  if (digest !== expected.sha256) issues.push(`${file}: checksum divergente`);
  if (rows !== expected.rows) issues.push(`${file}: ${rows} linhas; esperado ${expected.rows}`);
}

const users = new Set(readJsonl("auth/users.jsonl").map((row) => row.id));
const organizations = new Set(readJsonl("cadastro/organizations.jsonl").map((row) => row.id));
const sections = new Set(readJsonl("formulario/sections.jsonl").map((row) => row.id));
const questions = new Set(readJsonl("formulario/questions.jsonl").map((row) => row.id));
const questionVersions = new Set(
  readJsonl("formulario/question_versions.jsonl").map((row) => row.id),
);
const forms = new Set(readJsonl("formulario/forms.jsonl").map((row) => row.id));
const formVersions = new Set(readJsonl("formulario/form_versions.jsonl").map((row) => row.id));
const cyclesRows = readJsonl("diagnostico/cycles.jsonl");
const cycles = new Set(cyclesRows.map((row) => row.id));
const responseRows = readJsonl("diagnostico/responses.jsonl");
const responses = new Set(responseRows.map((row) => row.id));
const evidenceRows = readJsonl("diagnostico/evidences.jsonl");

for (const row of readJsonl("cadastro/profiles.jsonl")) {
  if (!users.has(row.user_id)) issues.push(`profiles.user_id ${row.user_id}: usuário Auth ausente`);
  if (row.organization_id && !organizations.has(row.organization_id)) {
    issues.push(`profiles.organization_id ${row.organization_id}: órgão ausente`);
  }
}
for (const row of readJsonl("formulario/questions.jsonl")) {
  if (!sections.has(row.section_id)) issues.push(`questions.section_id ${row.section_id}: seção ausente`);
}
for (const row of readJsonl("formulario/question_versions.jsonl")) {
  if (!questions.has(row.question_id)) {
    issues.push(`question_versions.question_id ${row.question_id}: pergunta ausente`);
  }
}
for (const row of readJsonl("formulario/form_versions.jsonl")) {
  if (!forms.has(row.form_id)) issues.push(`form_versions.form_id ${row.form_id}: formulário ausente`);
}
for (const row of readJsonl("formulario/form_assignments.jsonl")) {
  if (!forms.has(row.form_id)) issues.push(`form_assignments.form_id ${row.form_id}: formulário ausente`);
  if (!organizations.has(row.organization_id)) {
    issues.push(`form_assignments.organization_id ${row.organization_id}: órgão ausente`);
  }
}
for (const row of cyclesRows) {
  if (!organizations.has(row.organization_id)) issues.push(`cycles.organization_id ${row.organization_id}: órgão ausente`);
  if (!formVersions.has(row.form_version_id)) issues.push(`cycles.form_version_id ${row.form_version_id}: versão ausente`);
}
for (const row of responseRows) {
  if (!cycles.has(row.cycle_id)) issues.push(`responses.cycle_id ${row.cycle_id}: ciclo ausente`);
  if (!questionVersions.has(row.question_version_id)) {
    issues.push(`responses.question_version_id ${row.question_version_id}: versão de pergunta ausente`);
  }
}
for (const row of evidenceRows) {
  if (!responses.has(row.response_id)) issues.push(`evidences.response_id ${row.response_id}: resposta ausente`);
  if (!['link', 'text'].includes(row.kind)) issues.push(`evidences ${row.id}: kind ${row.kind} não suportado neste bootstrap`);
  if (row.file_validation_status !== 'not_applicable' || row.file_validated_at !== null) {
    issues.push(`evidences ${row.id}: validação estrutural incompatível com evidência ${row.kind}`);
  }
  if (row.kind === 'link' && (!row.external_link || !row.link_reason || row.storage_path || row.text_body || row.original_filename)) {
    issues.push(`evidences ${row.id}: payload de link viola o contrato atual`);
  }
  if (row.kind === 'text' && (!row.text_body || row.storage_path || row.external_link || row.original_filename)) {
    issues.push(`evidences ${row.id}: payload textual viola o contrato atual`);
  }
}

const responseCycleIds = new Set(responseRows.map((row) => row.cycle_id));
for (const row of cyclesRows) {
  if (!responseCycleIds.has(row.id)) issues.push(`cycles ${row.id}: ciclo sem respostas não deveria estar no bootstrap canônico`);
}

if (issues.length) {
  console.error(issues.slice(0, 100).map((issue) => `✗ ${issue}`).join("\n"));
  if (issues.length > 100) console.error(`✗ ... e mais ${issues.length - 100} inconsistências`);
  process.exit(1);
}
console.log(`✓ ${manifest.dataset}`);
console.log(`✓ ${manifest.summary.organizations} órgãos / ${manifest.summary.authUsers} usuários`);
console.log(`✓ ${manifest.summary.questions} perguntas / ${manifest.summary.responses} respostas / ${manifest.summary.evidences} evidências`);
console.log(`✓ ${manifest.summary.cyclesWithResponses} ciclos com respostas`);
console.log("✓ referências internas e contrato de evidências compatíveis com o schema atual");
