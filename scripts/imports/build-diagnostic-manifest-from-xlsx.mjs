#!/usr/bin/env node

import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  loadDiagnosticImportManifest,
  responseEvidenceUrls,
} from "./lib/diagnostic-response-import.mjs";
import {
  RAW_ANSWER_COLUMNS,
  canonicalOrganizationAcronym,
  normalizeHistoricalAnswer,
  supportingFieldsForQuestion,
  validateRawWorksheet,
} from "./lib/diagnostic-integrity-2026-workbook.mjs";
import { cellValue, readWorksheetFile } from "./lib/xlsx-reader.mjs";
import { loadDiagnosticIntegrity2026Catalog } from "./lib/diagnostic-integrity-2026-catalog.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultOutput = resolve(root, "var/imports/diagnostico_integridade_2026.json");

function printHelp() {
  console.log(`
Uso:
  node scripts/imports/build-diagnostic-manifest-from-xlsx.mjs --file <planilha.xlsx> [--output <manifesto.json>]

Opções:
  --file <xlsx|csv>   Planilha histórica original (aba Página1) ou export CSV no mesmo layout
  --output <json>     Destino do manifesto (padrão: var/imports/diagnostico_integridade_2026.json)
  --help              Exibe esta ajuda

O manifesto contém dados pessoais e respostas institucionais. Mantenha-o fora do Git.
`);
}

function parseArgs(argv) {
  const args = { file: "", output: defaultOutput, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help") args.help = true;
    else if (token === "--file") args.file = resolve(argv[++index] ?? "");
    else if (token === "--output") args.output = resolve(argv[++index] ?? "");
    else throw new Error(`Opção desconhecida: ${token}`);
  }
  if (!args.help && !args.file) throw new Error("Informe a planilha com --file.");
  return args;
}

function loadCatalogQuestions() {
  const questions = loadDiagnosticIntegrity2026Catalog().map((question) => ({
    source_order: question.source_order,
    prompt: question.prompt,
    requires_evidence: question.requires_evidence,
  }));
  if (questions.length !== RAW_ANSWER_COLUMNS.length) {
    throw new Error(
      `Catálogo incompatível: ${questions.length} critérios; esperados ${RAW_ANSWER_COLUMNS.length}.`,
    );
  }
  return questions;
}

function excelSerialToFortalezaIso(value) {
  const text = String(value ?? "").trim();
  const asDate = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (asDate) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = asDate;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
  }
  const serial = Number(text);
  if (!Number.isFinite(serial)) throw new Error(`Carimbo de data/hora inválido: ${value}`);
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}-03:00`;
}

function normalizeRegistration(value) {
  const text = String(value ?? "").trim();
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text || null;
}

function buildRecord({ row, headers, catalog }) {
  const organizationName = cellValue(row, 1);
  const organizationAcronym = canonicalOrganizationAcronym(organizationName);
  const responses = catalog.map((question, questionIndex) => {
    const answerColumn = RAW_ANSWER_COLUMNS[questionIndex];
    const normalized = normalizeHistoricalAnswer(cellValue(row, answerColumn - 1));
    const supportingFields = supportingFieldsForQuestion({ headers, row, questionIndex });
    const hasEvidence = supportingFields.some((field) => field.urls.length > 0);
    return {
      source_order: question.source_order,
      answer: normalized.answer,
      answer_original: normalized.answer_original,
      requires_evidence: question.requires_evidence,
      validation_status: normalized.answer === "yes" && hasEvidence ? "approved" : null,
      supporting_fields: supportingFields,
      inferred: normalized.inferred,
      override: null,
      normalization_reason: normalized.normalization_reason,
    };
  });

  return {
    organization_acronym: organizationAcronym,
    organization_name_source: organizationName,
    submitted_at_source: excelSerialToFortalezaIso(cellValue(row, 0)),
    respondent: {
      full_name: cellValue(row, 2),
      registration_number: normalizeRegistration(cellValue(row, 3)),
      organizational_unit: cellValue(row, 4) || null,
      position_title: cellValue(row, 5) || null,
      declaration: cellValue(row, 6) || null,
    },
    waivers: [],
    responses,
  };
}

function buildManifest(filePath) {
  const rows = readWorksheetFile(filePath);
  validateRawWorksheet(rows);
  const catalog = loadCatalogQuestions();
  const headers = rows[0];
  const records = rows
    .slice(1)
    .filter((row) => cellValue(row, 1))
    .map((row) => buildRecord({ row, headers, catalog }))
    .sort((a, b) => a.organization_acronym.localeCompare(b.organization_acronym, "pt-BR"));

  const acronyms = new Set();
  for (const record of records) {
    if (acronyms.has(record.organization_acronym)) {
      throw new Error(`Órgão duplicado na planilha: ${record.organization_acronym}.`);
    }
    acronyms.add(record.organization_acronym);
  }

  const questions = catalog.map((question, index) => ({
    ...question,
    raw_answer_column: RAW_ANSWER_COLUMNS[index],
  }));
  const allResponses = records.flatMap((record) => record.responses);
  const evidenceLinks = allResponses.reduce(
    (total, response) => total + responseEvidenceUrls(response).length,
    0,
  );
  const supportingTextCount = allResponses.reduce(
    (total, response) =>
      total + response.supporting_fields.filter((field) => Boolean(field.text)).length,
    0,
  );
  const approved = allResponses.filter((response) => response.validation_status === "approved").length;

  return {
    schema_version: 2,
    form_name: "Diagnóstico de Integridade 2026",
    period_label: "Diagnóstico de Integridade 2026",
    source: {
      workbook: basename(filePath),
      worksheet: "Página1",
      generated_at: new Date().toISOString(),
    },
    questions,
    records,
    summary: {
      respondent_count: records.length,
      response_count: allResponses.length,
      answers: {
        yes: allResponses.filter((response) => response.answer === "yes").length,
        no: allResponses.filter((response) => response.answer === "no").length,
      },
      inferred_blank_answer_count: allResponses.filter((response) => response.inferred).length,
      evidence_validations: {
        approved,
        not_applicable_or_without_link: allResponses.length - approved,
      },
      evidence_link_count: evidenceLinks,
      supporting_text_count: supportingTextCount,
      waiver_count: records.reduce((total, record) => total + record.waivers.length, 0),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  const manifest = buildManifest(args.file);
  mkdirSync(dirname(args.output), { recursive: true });
  writeFileSync(args.output, `${JSON.stringify(manifest, null, 2)}\n`);
  loadDiagnosticImportManifest(args.output);
  console.log(`✓ Manifesto gerado: ${args.output}`);
  console.log(
    `✓ ${manifest.summary.respondent_count} órgãos, ${manifest.summary.response_count} respostas e ${manifest.summary.evidence_link_count} links preservados no domínio normal.`,
  );
}

try {
  main();
} catch (error) {
  console.error(`\n✖ ${error?.message ?? String(error)}\n`);
  process.exit(1);
}
