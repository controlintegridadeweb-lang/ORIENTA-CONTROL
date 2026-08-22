#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const outputDir = resolve(root, "data/bootstrap-2026/private");

const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.slice("--source=".length);
if (!sourceArg) {
  throw new Error(
    "Informe o diretório exportado do snapshot: npm run bootstrap:2026:build-from-snapshot -- --source=/caminho/output/export",
  );
}

function resolveExportDir(input) {
  const candidate = resolve(process.cwd(), input);
  const variants = [candidate, resolve(candidate, "output/export"), resolve(candidate, "export")];
  const found = variants.find(
    (dir) => existsSync(resolve(dir, "manifest.json")) && existsSync(resolve(dir, "responses.jsonl")),
  );
  if (!found) {
    throw new Error(
      `Snapshot inválido em ${candidate}: não encontrei manifest.json e responses.jsonl no diretório informado, em output/export ou em export.`,
    );
  }
  return found;
}

const sourceDir = resolveExportDir(sourceArg);
const sourceManifest = JSON.parse(readFileSync(resolve(sourceDir, "manifest.json"), "utf8"));

const copyPlan = [
  ["organizations.jsonl", "cadastro/organizations.jsonl"],
  ["profiles.jsonl", "cadastro/profiles.jsonl"],
  ["respondent_profile_details.jsonl", "cadastro/respondent_profile_details.jsonl"],
  ["axes.jsonl", "formulario/axes.jsonl"],
  ["sections.jsonl", "formulario/sections.jsonl"],
  ["questions.jsonl", "formulario/questions.jsonl"],
  ["question_versions.jsonl", "formulario/question_versions.jsonl"],
  ["question_library_binding.jsonl", "formulario/question_library_binding.jsonl"],
  ["forms.jsonl", "formulario/forms.jsonl"],
  ["form_drafts.jsonl", "formulario/form_drafts.jsonl"],
  ["form_draft_questions.jsonl", "formulario/form_draft_questions.jsonl"],
  ["form_versions.jsonl", "formulario/form_versions.jsonl"],
  ["form_questions.jsonl", "formulario/form_questions.jsonl"],
  ["form_assignments.jsonl", "formulario/form_assignments.jsonl"],
  ["form_periods.jsonl", "formulario/form_periods.jsonl"],
  ["responses.jsonl", "diagnostico/responses.jsonl"],
];

function readJsonl(path) {
  if (!existsSync(path)) throw new Error(`Arquivo obrigatório ausente: ${path}`);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: JSON inválido`, { cause: error });
      }
    });
}

function writeJsonl(relativePath, rows) {
  const path = resolve(outputDir, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  const content = rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  writeFileSync(path, content, "utf8");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function copyRows(sourceFile, destinationFile) {
  writeJsonl(destinationFile, readJsonl(resolve(sourceDir, sourceFile)));
}

function transformEvidences() {
  const rows = readJsonl(resolve(sourceDir, "evidences.jsonl"));
  const transformed = rows.map((source) => {
    if (source.kind === "file") {
      throw new Error(
        `Evidência ${source.id} é arquivo físico. Esta transformação não infere validação estrutural de arquivo; migre o Storage e trate o arquivo explicitamente.`,
      );
    }
    const {
      malware_scan_status: _malwareScanStatus,
      malware_scan_started_at: _malwareScanStartedAt,
      malware_scanned_at: _malwareScannedAt,
      malware_scan_engine: _malwareScanEngine,
      malware_signature: _malwareSignature,
      ...current
    } = source;
    return {
      ...current,
      file_validation_status: "not_applicable",
      file_validated_at: null,
    };
  });
  writeJsonl("diagnostico/evidences.jsonl", transformed);
}

function filterCyclesWithResponses() {
  const responses = readJsonl(resolve(sourceDir, "responses.jsonl"));
  const cycleIds = new Set(responses.map((row) => row.cycle_id));
  const cycles = readJsonl(resolve(sourceDir, "cycles.jsonl"));
  const selected = cycles.filter((row) => cycleIds.has(row.id));
  if (selected.length !== cycleIds.size) {
    const selectedIds = new Set(selected.map((row) => row.id));
    const missing = [...cycleIds].filter((id) => !selectedIds.has(id));
    throw new Error(`Há respostas ligadas a ciclos ausentes no snapshot: ${missing.join(", ")}`);
  }
  writeJsonl("diagnostico/cycles.jsonl", selected);
  return selected.length;
}

function copySafeAuthUsers() {
  const source = resolve(sourceDir, "auth/users-safe.jsonl");
  writeJsonl("auth/users.jsonl", readJsonl(source));
}

function assertReferentialIntegrity() {
  const load = (file) => readJsonl(resolve(outputDir, file));
  const organizations = new Set(load("cadastro/organizations.jsonl").map((row) => row.id));
  const users = new Set(load("auth/users.jsonl").map((row) => row.id));
  const sections = new Set(load("formulario/sections.jsonl").map((row) => row.id));
  const questions = new Set(load("formulario/questions.jsonl").map((row) => row.id));
  const questionVersions = new Set(load("formulario/question_versions.jsonl").map((row) => row.id));
  const formVersions = new Set(load("formulario/form_versions.jsonl").map((row) => row.id));
  const cycles = new Set(load("diagnostico/cycles.jsonl").map((row) => row.id));
  const responses = load("diagnostico/responses.jsonl");
  const responseIds = new Set(responses.map((row) => row.id));
  const issues = [];

  for (const row of load("cadastro/profiles.jsonl")) {
    if (!users.has(row.user_id)) issues.push(`profiles.user_id ${row.user_id} sem auth.users`);
    if (row.organization_id && !organizations.has(row.organization_id)) {
      issues.push(`profiles.organization_id ${row.organization_id} ausente`);
    }
  }
  for (const row of load("formulario/questions.jsonl")) {
    if (!sections.has(row.section_id)) issues.push(`questions.section_id ${row.section_id} ausente`);
  }
  for (const row of load("formulario/question_versions.jsonl")) {
    if (!questions.has(row.question_id)) issues.push(`question_versions.question_id ${row.question_id} ausente`);
  }
  for (const row of load("diagnostico/cycles.jsonl")) {
    if (!organizations.has(row.organization_id)) issues.push(`cycles.organization_id ${row.organization_id} ausente`);
    if (!formVersions.has(row.form_version_id)) issues.push(`cycles.form_version_id ${row.form_version_id} ausente`);
  }
  for (const row of responses) {
    if (!cycles.has(row.cycle_id)) issues.push(`responses.cycle_id ${row.cycle_id} ausente`);
    if (!questionVersions.has(row.question_version_id)) {
      issues.push(`responses.question_version_id ${row.question_version_id} ausente`);
    }
  }
  for (const row of load("diagnostico/evidences.jsonl")) {
    if (!responseIds.has(row.response_id)) issues.push(`evidences.response_id ${row.response_id} ausente`);
    if (row.kind === "file") issues.push(`evidences ${row.id}: arquivo físico não esperado`);
    if (row.file_validation_status !== "not_applicable") {
      issues.push(`evidences ${row.id}: file_validation_status inválido para ${row.kind}`);
    }
  }
  if (issues.length) {
    throw new Error(`Bootstrap transformado possui referências inválidas:\n- ${issues.slice(0, 50).join("\n- ")}`);
  }
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const [source, destination] of copyPlan) copyRows(source, destination);
copySafeAuthUsers();
const cyclesWithResponses = filterCyclesWithResponses();
transformEvidences();
assertReferentialIntegrity();

const targetFiles = [
  "auth/users.jsonl",
  ...copyPlan.map(([, destination]) => destination),
  "diagnostico/cycles.jsonl",
  "diagnostico/evidences.jsonl",
].sort();

const files = Object.fromEntries(
  targetFiles.map((file) => {
    const path = resolve(outputDir, file);
    return [
      file,
      {
        rows: readJsonl(path).length,
        sha256: sha256(path),
      },
    ];
  }),
);

const count = (file) => files[file].rows;
const manifest = {
  dataset: "ORIENTA 2026 — bootstrap canônico real",
  generatedAt: new Date().toISOString(),
  source: {
    snapshot: basename(dirname(dirname(sourceDir))),
    exportedAt: sourceManifest.exportedAt ?? null,
    sourceSchemaVersion: sourceManifest.schemaVersion ?? null,
    transformation: "bootstrap-2026-v1",
  },
  policy: {
    preserveCurrentStateOnly: true,
    excludedHistoricalDomains: [
      "audit_logs",
      "snapshots",
      "notifications",
      "reopen/submission/deadline events",
      "cycle_processings",
      "historical FAMI results",
      "materialized recommendations",
      "legacy action plans",
      "legacy reports",
    ],
  },
  summary: {
    organizations: count("cadastro/organizations.jsonl"),
    authUsers: count("auth/users.jsonl"),
    profiles: count("cadastro/profiles.jsonl"),
    axes: count("formulario/axes.jsonl"),
    sections: count("formulario/sections.jsonl"),
    questions: count("formulario/questions.jsonl"),
    assignments: count("formulario/form_assignments.jsonl"),
    cyclesWithResponses,
    responses: count("diagnostico/responses.jsonl"),
    evidences: count("diagnostico/evidences.jsonl"),
  },
  files,
};

writeFileSync(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`✓ Bootstrap gerado em ${outputDir}`);
console.log(
  `✓ ${manifest.summary.organizations} órgãos / ${manifest.summary.authUsers} usuários / ${manifest.summary.cyclesWithResponses} ciclos com respostas`,
);
console.log(`✓ ${manifest.summary.responses} respostas / ${manifest.summary.evidences} evidências`);
