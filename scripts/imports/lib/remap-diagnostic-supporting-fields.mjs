import {
  SUPPORTING_COLUMN_BINDINGS,
  supportingFieldContributesEvidence,
  targetSourceOrdersForSupportingColumn,
} from "./diagnostic-integrity-2026-supporting-map.mjs";

function cloneSupportingField(field, sourceOrder) {
  return {
    source_column: field.source_column,
    source_header: field.source_header,
    text: field.text ?? null,
    urls: [...(field.urls ?? [])],
    contributes_evidence: supportingFieldContributesEvidence(field.source_column),
    target_source_order: sourceOrder,
  };
}

function evidenceUrlsForResponse(response) {
  if (response.answer !== "yes") return [];
  const urls = [];
  for (const field of response.supporting_fields ?? []) {
    if (field.contributes_evidence === false) continue;
    for (const url of field.urls ?? []) {
      if (!urls.includes(url)) urls.push(url);
    }
  }
  return urls;
}

/**
 * Reatribui supporting_fields do manifesto pelo mapeamento explícito de colunas.
 * Idempotente: pode ser reaplicado sobre manifesto já remapeado.
 */
export function remapManifestSupportingFields(manifest) {
  if (!manifest?.records) throw new Error("Manifesto inválido para remapeamento.");

  for (const record of manifest.records) {
    const byColumn = new Map();
    for (const response of record.responses) {
      for (const field of response.supporting_fields ?? []) {
        const previous = byColumn.get(field.source_column);
        if (!previous) {
          byColumn.set(field.source_column, {
            source_column: field.source_column,
            source_header: field.source_header,
            text: field.text ?? null,
            urls: [...(field.urls ?? [])],
          });
          continue;
        }
        if (!previous.text && field.text) previous.text = field.text;
        for (const url of field.urls ?? []) {
          if (!previous.urls.includes(url)) previous.urls.push(url);
        }
      }
      response.supporting_fields = [];
    }

    for (const field of byColumn.values()) {
      if (!SUPPORTING_COLUMN_BINDINGS[field.source_column]) {
        throw new Error(
          `${record.organization_acronym}: coluna auxiliar ${field.source_column} sem mapeamento explícito.`,
        );
      }
      for (const sourceOrder of targetSourceOrdersForSupportingColumn(field.source_column)) {
        const response = record.responses[sourceOrder - 1];
        if (!response) {
          throw new Error(
            `${record.organization_acronym}: critério ${sourceOrder} ausente no manifesto.`,
          );
        }
        response.supporting_fields.push(cloneSupportingField(field, sourceOrder));
      }
    }

    for (const response of record.responses) {
      response.supporting_fields.sort((a, b) => a.source_column - b.source_column);
      const hasEvidence = evidenceUrlsForResponse(response).length > 0;
      response.validation_status =
        response.answer === "yes" && hasEvidence ? "approved" : null;
    }
  }

  return manifest;
}

export function expectedEvidenceLinksBySourceOrder(record) {
  /** @type {Map<number, string[]>} */
  const byOrder = new Map();
  for (const response of record.responses) {
    const urls = evidenceUrlsForResponse(response);
    if (urls.length) byOrder.set(response.source_order, urls);
  }
  return byOrder;
}

export function orphanEvidenceUrls(record) {
  const urls = [];
  for (const response of record.responses) {
    for (const field of response.supporting_fields ?? []) {
      if (field.contributes_evidence === false) {
        for (const url of field.urls ?? []) {
          if (!urls.includes(url)) urls.push(url);
        }
      }
    }
  }
  return urls;
}
