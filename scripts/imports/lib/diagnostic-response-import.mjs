import { readFileSync } from "node:fs";
import { remapManifestSupportingFields } from "./remap-diagnostic-supporting-fields.mjs";

const EXPECTED_SCHEMA_VERSION = 2;
const EXPECTED_QUESTION_COUNT = 126;

export function normalizeComparableText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function assertString(value, path, { allowBlank = false } = {}) {
  if (typeof value !== "string" || (!allowBlank && !value.trim())) {
    throw new Error(`${path} deve ser um texto${allowBlank ? "" : " não vazio"}.`);
  }
}

function assertUnique(items, key, label) {
  const values = new Set();
  for (const item of items) {
    const value = key(item);
    if (values.has(value)) throw new Error(`${label} duplicado: ${value}.`);
    values.add(value);
  }
}

function validateSupportingField(field, path) {
  if (!Number.isInteger(field?.source_column) || field.source_column < 1) {
    throw new Error(`${path}.source_column inválido.`);
  }
  assertString(field.source_header, `${path}.source_header`);
  if (field.text !== null && field.text !== undefined) {
    assertString(field.text, `${path}.text`, { allowBlank: false });
  }
  if (
    field.contributes_evidence !== undefined &&
    typeof field.contributes_evidence !== "boolean"
  ) {
    throw new Error(`${path}.contributes_evidence deve ser booleano.`);
  }
  if (
    field.target_source_order !== undefined &&
    (!Number.isInteger(field.target_source_order) || field.target_source_order < 1)
  ) {
    throw new Error(`${path}.target_source_order inválido.`);
  }
  if (!Array.isArray(field.urls)) throw new Error(`${path}.urls deve ser uma lista.`);
  assertUnique(field.urls, (url) => url, `${path}.urls`);
  for (const [index, url] of field.urls.entries()) {
    assertString(url, `${path}.urls[${index}]`);
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`${path}.urls[${index}] não é uma URL HTTP(S) válida.`);
    }
  }
}

export function validateDiagnosticImportManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Manifesto de importação inválido.");
  }
  if (manifest.schema_version !== EXPECTED_SCHEMA_VERSION) {
    throw new Error(`schema_version incompatível: ${manifest.schema_version}.`);
  }
  assertString(manifest.form_name, "form_name");
  assertString(manifest.period_label, "period_label");
  if (!Array.isArray(manifest.questions) || manifest.questions.length !== EXPECTED_QUESTION_COUNT) {
    throw new Error(`O manifesto precisa conter ${EXPECTED_QUESTION_COUNT} perguntas.`);
  }
  assertUnique(manifest.questions, (question) => question.source_order, "source_order de pergunta");
  for (const [index, question] of manifest.questions.entries()) {
    if (question.source_order !== index + 1) {
      throw new Error(`questions[${index}].source_order deve ser ${index + 1}.`);
    }
    assertString(question.prompt, `questions[${index}].prompt`);
    if (typeof question.requires_evidence !== "boolean") {
      throw new Error(`questions[${index}].requires_evidence deve ser booleano.`);
    }
  }

  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    throw new Error("O manifesto não contém órgãos respondentes.");
  }
  assertUnique(manifest.records, (record) => record.organization_acronym, "sigla de órgão");

  for (const [recordIndex, record] of manifest.records.entries()) {
    const prefix = `records[${recordIndex}]`;
    assertString(record.organization_acronym, `${prefix}.organization_acronym`);
    assertString(record.respondent?.full_name, `${prefix}.respondent.full_name`);
    if (!Array.isArray(record.responses) || record.responses.length !== EXPECTED_QUESTION_COUNT) {
      throw new Error(`${prefix}.responses precisa conter ${EXPECTED_QUESTION_COUNT} itens.`);
    }
    if (!Array.isArray(record.waivers)) throw new Error(`${prefix}.waivers deve ser uma lista.`);
    for (const [field, required] of [
      ["registration_number", false],
      ["organizational_unit", false],
      ["position_title", false],
      ["declaration", false],
    ]) {
      const value = record.respondent?.[field];
      if (required && !value) throw new Error(`${prefix}.respondent.${field} é obrigatório.`);
      if (value !== null && value !== undefined) {
        assertString(value, `${prefix}.respondent.${field}`);
      }
    }
    assertUnique(record.responses, (response) => response.source_order, `${prefix}.responses.source_order`);
    assertUnique(record.waivers, (waiver) => waiver.source_order, `${prefix}.waivers.source_order`);

    const waiverOrders = new Set(record.waivers.map((waiver) => waiver.source_order));
    for (const [responseIndex, response] of record.responses.entries()) {
      const responsePath = `${prefix}.responses[${responseIndex}]`;
      if (response.source_order !== responseIndex + 1) {
        throw new Error(`${responsePath}.source_order deve ser ${responseIndex + 1}.`);
      }
      if (!['yes', 'no'].includes(response.answer)) {
        throw new Error(`${responsePath}.answer deve ser yes ou no.`);
      }
      if (typeof response.requires_evidence !== "boolean") {
        throw new Error(`${responsePath}.requires_evidence deve ser booleano.`);
      }
      if (![null, 'approved', 'invalidated'].includes(response.validation_status)) {
        throw new Error(`${responsePath}.validation_status inválido.`);
      }
      if (!Array.isArray(response.supporting_fields)) {
        throw new Error(`${responsePath}.supporting_fields deve ser uma lista.`);
      }
      response.supporting_fields.forEach((field, fieldIndex) =>
        validateSupportingField(field, `${responsePath}.supporting_fields[${fieldIndex}]`),
      );
      if (waiverOrders.has(response.source_order) && response.override) {
        throw new Error(`${responsePath} não pode combinar waiver e override.`);
      }
    }
    for (const [waiverIndex, waiver] of record.waivers.entries()) {
      if (!Number.isInteger(waiver.source_order) || waiver.source_order < 1 || waiver.source_order > 126) {
        throw new Error(`${prefix}.waivers[${waiverIndex}].source_order inválido.`);
      }
      assertString(waiver.reason, `${prefix}.waivers[${waiverIndex}].reason`);
    }
  }
  return manifest;
}

export function loadDiagnosticImportManifest(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const remapped = remapManifestSupportingFields(raw);
  return validateDiagnosticImportManifest(remapped);
}

export function responseEvidenceUrls(response) {
  const urls = [];
  for (const field of response.supporting_fields) {
    if (field.contributes_evidence === false) continue;
    for (const url of field.urls) {
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return response.answer === "yes" ? urls : [];
}

function supportTextLines(response) {
  const lines = [];
  for (const field of response.supporting_fields) {
    const text = field.text?.trim();
    if (text) lines.push(`${field.source_header}: ${text}`);
    const orphan = field.contributes_evidence === false;
    if (orphan) {
      for (const url of field.urls) {
        lines.push(
          `${field.source_header} — referência legada sem critério oficial (coluna ${field.source_column}): ${url}`,
        );
      }
      continue;
    }
    if (response.answer === "no") {
      for (const url of field.urls) {
        lines.push(`${field.source_header} — referência informada: ${url}`);
      }
    }
  }
  return [...new Set(lines)];
}

export function buildImportedResponseNotes(response) {
  const notes = [];
  if (response.answer_original) notes.push(`Resposta original: ${response.answer_original}.`);
  if (response.normalization_reason) notes.push(response.normalization_reason);
  if (response.override) notes.push(response.override);
  notes.push(...supportTextLines(response));
  return notes.filter(Boolean).join("\n").trim() || null;
}

export function evidencePayload(response, existingUrls = new Set()) {
  const urls = responseEvidenceUrls(response).filter((url) => !existingUrls.has(url));
  if (urls.length > 20) {
    throw new Error(`Critério ${response.source_order}: mais de 20 evidências no mesmo lote.`);
  }
  return urls.map((url) => ({
    kind: "link",
    external_link: url,
    link_reason: "Comprovação importada do formulário legado do Diagnóstico de Integridade 2026.",
    title: `Comprovação legada — critério ${response.source_order}`,
  }));
}

export function expectedEvidenceValidationStatus(response) {
  const urls = responseEvidenceUrls(response);
  if (urls.length === 0) return null;
  return response.validation_status;
}
