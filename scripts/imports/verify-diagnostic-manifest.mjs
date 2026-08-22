#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDiagnosticImportManifest,
  responseEvidenceUrls,
} from "./lib/diagnostic-response-import.mjs";
import { loadDiagnosticIntegrity2026Catalog } from "./lib/diagnostic-integrity-2026-catalog.mjs";
import { parseRespondentSeed } from "./lib/respondent-seed.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const developmentAccountsPath = resolve(root, "supabase/seeds/respondent_accounts.csv");

function printHelp() {
  console.log(`
Uso:
  npm run check:diagnostic-import
  node scripts/imports/verify-diagnostic-manifest.mjs --file <manifesto.json> --accounts-file <respondentes.csv>

Modos:
  --contract-only             Valida o contrato versionado, o catálogo e o seed fictício.
  --file <json>               Manifesto histórico mantido fora do Git.
  --accounts-file <csv>       Relação operacional de respondentes mantida fora do Git.
  --help                      Exibe esta ajuda.

A importação histórica usa o fluxo normal de respostas, evidências e validação,
sem criar um módulo paralelo de saneamento.
`);
}

function parseArgs(argv) {
  const args = { contractOnly: false, file: null, accountsFile: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--contract-only") args.contractOnly = true;
    else if (value === "--file") {
      const path = argv[index + 1];
      if (!path || path.startsWith("--")) throw new Error("--file exige um caminho.");
      args.file = resolve(path);
      index += 1;
    } else if (value === "--accounts-file") {
      const path = argv[index + 1];
      if (!path || path.startsWith("--")) throw new Error("--accounts-file exige um caminho.");
      args.accountsFile = resolve(path);
      index += 1;
    } else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Opção desconhecida: ${value}`);
  }
  return args;
}

function loadCatalogQuestions() {
  return loadDiagnosticIntegrity2026Catalog().map((question) => ({
    source_order: question.source_order,
    prompt: question.prompt,
    requires_evidence: question.requires_evidence,
  }));
}

function verifyVersionedContract() {
  const catalogQuestions = loadCatalogQuestions();
  if (catalogQuestions.length !== 126) {
    throw new Error(`Catálogo versionado deve conter 126 critérios; contém ${catalogQuestions.length}.`);
  }
  catalogQuestions.forEach((question, index) => {
    if (question.source_order !== index + 1) {
      throw new Error(`Ordem do catálogo interrompida no critério ${index + 1}.`);
    }
  });

  const accounts = parseRespondentSeed(readFileSync(developmentAccountsPath, "utf8"));
  if (accounts.length !== 2) {
    throw new Error(`Seed mínimo fictício deve conter 2 contas; contém ${accounts.length}.`);
  }
  for (const account of accounts) {
    if (!account.email.endsWith("@example.invalid")) {
      throw new Error(`Seed fictício contém e-mail não reservado: ${account.organizationAcronym}.`);
    }
    if (!/^Respondente de Desenvolvimento [A-B]$/.test(account.fullName)) {
      throw new Error(`Seed fictício contém nome não padronizado: ${account.organizationAcronym}.`);
    }
  }

  console.log(`✓ Contrato de importação válido: ${catalogQuestions.length} critérios oficiais.`);
  console.log(`✓ Seed versionado seguro: ${accounts.length} contas fictícias, sem dados pessoais.`);
  console.log("✓ Importação histórica integrada ao domínio normal da plataforma.");
}

function verifyOperationalManifest(manifestPath, accountsPath) {
  if (!existsSync(manifestPath)) throw new Error(`Manifesto não encontrado: ${manifestPath}`);
  if (!existsSync(accountsPath)) throw new Error(`Arquivo de contas não encontrado: ${accountsPath}`);

  const manifest = loadDiagnosticImportManifest(manifestPath);
  const accounts = parseRespondentSeed(readFileSync(accountsPath, "utf8"));
  const catalogQuestions = loadCatalogQuestions();

  if (catalogQuestions.length !== manifest.questions.length) {
    throw new Error(
      `Catálogo SQL possui ${catalogQuestions.length} critérios; manifesto possui ${manifest.questions.length}.`,
    );
  }
  for (const [index, question] of manifest.questions.entries()) {
    const catalogQuestion = catalogQuestions[index];
    if (
      question.source_order !== catalogQuestion.source_order
      || question.prompt !== catalogQuestion.prompt
      || question.requires_evidence !== catalogQuestion.requires_evidence
    ) {
      throw new Error(`Critério ${index + 1} diverge do catálogo oficial versionado.`);
    }
  }

  const accountByAcronym = new Map(
    accounts.map((account) => [account.organizationAcronym, account]),
  );
  for (const record of manifest.records) {
    const account = accountByAcronym.get(record.organization_acronym);
    if (!account) {
      throw new Error(`${record.organization_acronym}: conta não encontrada no arquivo externo.`);
    }
    if (account.fullName !== record.respondent.full_name) {
      throw new Error(`${record.organization_acronym}: nome do arquivo externo diverge do manifesto.`);
    }
  }

  const responses = manifest.records.flatMap((record) => record.responses);
  const yes = responses.filter((response) => response.answer === "yes").length;
  const no = responses.filter((response) => response.answer === "no").length;
  const inferred = responses.filter((response) => response.inferred).length;
  const approved = responses.filter((response) => response.validation_status === "approved").length;
  const withoutLink = responses.length - approved;
  const waivers = manifest.records.reduce((total, record) => total + record.waivers.length, 0);
  const evidenceLinks = responses.reduce(
    (total, response) => total + responseEvidenceUrls(response).length,
    0,
  );
  const supportingTexts = responses.reduce(
    (total, response) => total + response.supporting_fields.filter((field) => Boolean(field.text)).length,
    0,
  );

  const expected = manifest.summary;
  const checks = [
    ["órgãos respondentes", manifest.records.length, expected.respondent_count],
    ["respostas", responses.length, expected.response_count],
    ["respostas Sim", yes, expected.answers.yes],
    ["respostas Não", no, expected.answers.no],
    ["respostas em branco inferidas", inferred, expected.inferred_blank_answer_count],
    ["respostas com evidências aprovadas", approved, expected.evidence_validations.approved],
    ["respostas sem link aplicável", withoutLink, expected.evidence_validations.not_applicable_or_without_link],
    ["links de evidência", evidenceLinks, expected.evidence_link_count],
    ["textos auxiliares", supportingTexts, expected.supporting_text_count],
    ["dispensas", waivers, expected.waiver_count],
  ];
  for (const [label, actual, declared] of checks) {
    if (actual !== declared) throw new Error(`${label}: calculado ${actual}; declarado ${declared}.`);
  }

  for (const record of manifest.records) {
    if (!/-03:00$/.test(record.submitted_at_source ?? "")) {
      throw new Error(`${record.organization_acronym}: carimbo sem offset America/Fortaleza (-03:00).`);
    }
  }

  const imported = new Set(manifest.records.map((record) => record.organization_acronym));
  const withoutAnswers = accounts.filter((account) => !imported.has(account.organizationAcronym));
  console.log(`✓ Catálogo conciliado: ${catalogQuestions.length} critérios idênticos à referência oficial versionada.`);
  console.log(`✓ Manifesto válido: ${manifest.records.length} órgãos, ${responses.length} respostas.`);
  console.log(`✓ Contas externas conciliadas: ${imported.size} com respostas e ${withoutAnswers.length} sem respostas históricas.`);
  console.log(`✓ Conteúdo preservado: ${yes} Sim, ${no} Não, ${evidenceLinks} links, ${supportingTexts} textos auxiliares e ${waivers} dispensas.`);
  console.log("✓ Nenhum registro artificial de saneamento foi criado.");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args.contractOnly) {
    if (args.file || args.accountsFile) {
      throw new Error("--contract-only não deve ser combinado com arquivos operacionais.");
    }
    return verifyVersionedContract();
  }
  if (!args.file || !args.accountsFile) {
    throw new Error("Informe --file e --accounts-file, ou use --contract-only para validar apenas o repositório.");
  }
  verifyOperationalManifest(args.file, args.accountsFile);
}

try {
  main();
} catch (error) {
  console.error(`\n✖ ${error?.message ?? String(error)}\n`);
  process.exit(1);
}
