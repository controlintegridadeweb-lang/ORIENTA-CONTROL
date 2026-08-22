import { describe, expect, it } from "vitest";
import {
  SUPPORTING_COLUMN_BINDINGS,
  SUPPORTING_SOURCE_COLUMNS,
  classifySupportingAssignment,
  supportingFieldContributesEvidence,
  targetSourceOrdersForSupportingColumn,
} from "./diagnostic-integrity-2026-supporting-map.mjs";
import {
  expectedEvidenceLinksBySourceOrder,
  orphanEvidenceUrls,
  remapManifestSupportingFields,
} from "./remap-diagnostic-supporting-fields.mjs";
import {
  buildImportedResponseNotes,
  evidencePayload,
  responseEvidenceUrls,
} from "./diagnostic-response-import.mjs";
import {
  RAW_ANSWER_COLUMNS,
  extractUrls,
  supportingFieldsForQuestion,
} from "./diagnostic-integrity-2026-workbook.mjs";

function blankRow(length) {
  return Array.from({ length }, () => ({ value: "", hyperlinks: [] }));
}

function headersWith(map) {
  const max = Math.max(...Object.keys(map).map(Number), RAW_ANSWER_COLUMNS.at(-1));
  const headers = Array.from({ length: max }, () => ({ value: "" }));
  for (const [column, header] of Object.entries(map)) {
    headers[Number(column) - 1] = { value: header };
  }
  for (const column of RAW_ANSWER_COLUMNS) {
    if (!headers[column - 1]?.value) {
      headers[column - 1] = { value: `Critério resposta col ${column}` };
    }
  }
  return headers;
}

function baseResponses() {
  return Array.from({ length: 126 }, (_, index) => ({
    source_order: index + 1,
    answer: "no",
    answer_original: "Não",
    requires_evidence: false,
    validation_status: null,
    supporting_fields: [],
    inferred: false,
    override: null,
  }));
}

describe("mapeamento explícito de campos auxiliares do Diagnóstico 2026", () => {
  it("cobre todas as colunas auxiliares conhecidas da planilha", () => {
    expect(SUPPORTING_SOURCE_COLUMNS).toHaveLength(68);
    expect(Object.keys(SUPPORTING_COLUMN_BINDINGS)).toHaveLength(68);
  });

  it("associa a coluna 175 ao critério 109 e a 176 ao 110", () => {
    expect(targetSourceOrdersForSupportingColumn(175)).toEqual([109]);
    expect(targetSourceOrdersForSupportingColumn(176)).toEqual([110]);
    expect(
      classifySupportingAssignment({ sourceColumn: 175, assignedSourceOrder: 110 }),
    ).toBe("evidencia_vinculada_ao_criterio_errado");
    expect(
      classifySupportingAssignment({ sourceColumn: 175, assignedSourceOrder: 109 }),
    ).toBe("associacao_correta");
  });

  it("não trata campo órfão legado como evidência de critério oficial", () => {
    expect(supportingFieldContributesEvidence(108)).toBe(false);
    expect(targetSourceOrdersForSupportingColumn(108)).toEqual([61]);
    expect(
      classifySupportingAssignment({ sourceColumn: 108, assignedSourceOrder: 61 }),
    ).toBe("associacao_ambigua");
  });

  it("Sim com link na pergunta complementar vincula ao critério principal", () => {
    const headers = headersWith({
      175: "Caso tenha sido realizado diagnóstico no âmbito do órgão ou entidade, evidencie sua realização mediante a apresentação dos documentos correspondentes.",
      176: "Caso haja registro das ações de qualidade de vida, evidencie-o mediante a apresentação dos documentos correspondentes.",
    });
    const row = blankRow(headers.length);
    row[174] = {
      value: "https://drive.google.com/open?id=diag-109",
      hyperlinks: ["https://drive.google.com/open?id=diag-109"],
    };
    row[175] = {
      value: "https://drive.google.com/open?id=reg-110",
      hyperlinks: ["https://drive.google.com/open?id=reg-110"],
    };

    const fields109 = supportingFieldsForQuestion({ headers, row, questionIndex: 108 });
    const fields110 = supportingFieldsForQuestion({ headers, row, questionIndex: 109 });

    expect(fields109.map((field) => field.source_column)).toEqual([175]);
    expect(fields109[0].urls).toEqual(["https://drive.google.com/open?id=diag-109"]);
    expect(fields110.map((field) => field.source_column)).toEqual([176]);
    expect(fields110[0].urls).toEqual(["https://drive.google.com/open?id=reg-110"]);

    const response109 = {
      source_order: 109,
      answer: "yes",
      supporting_fields: fields109,
    };
    expect(responseEvidenceUrls(response109)).toEqual([
      "https://drive.google.com/open?id=diag-109",
    ]);
    expect(evidencePayload(response109)).toHaveLength(1);
  });

  it("Sim com vários links na complementar preserva todos sem duplicar", () => {
    const response = {
      answer: "yes",
      supporting_fields: [{
        source_column: 175,
        source_header: "Evidencie",
        text: null,
        urls: [
          "https://example.com/a",
          "https://example.com/b",
          "https://example.com/a",
        ],
        contributes_evidence: true,
      }],
    };
    // urls already unique in manifesto; extractUrls also dedupes raw cells
    response.supporting_fields[0].urls = [...new Set(response.supporting_fields[0].urls)];
    expect(responseEvidenceUrls(response)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(extractUrls("https://example.com/a\nhttps://example.com/b, https://example.com/a")).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("Sim sem evidência não inventa documento", () => {
    const response = {
      answer: "yes",
      supporting_fields: [{
        source_column: 175,
        source_header: "Evidencie",
        text: "Sem link anexado",
        urls: [],
        contributes_evidence: true,
      }],
    };
    expect(responseEvidenceUrls(response)).toEqual([]);
    expect(evidencePayload(response)).toEqual([]);
  });

  it("Não com campo complementar vazio não cria evidência", () => {
    const response = {
      answer: "no",
      supporting_fields: [],
    };
    expect(responseEvidenceUrls(response)).toEqual([]);
  });

  it("duas perguntas principais consecutivas recebem seus próprios campos de evidência", () => {
    const headers = headersWith({
      11: "Caso o órgão ou entidade possua Unidade de Controle Interno formalmente instituída, informe o ato normativo.",
      12: "Em caso de resposta afirmativa, comprove a divulgação da UCI.",
    });
    const row = blankRow(headers.length);
    row[10] = { value: "https://example.com/uci-ato", hyperlinks: [] };
    row[11] = { value: "https://example.com/uci-divulgacao", hyperlinks: [] };

    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 0 })).toEqual([
      expect.objectContaining({
        source_column: 11,
        urls: ["https://example.com/uci-ato"],
        target_source_order: 1,
      }),
    ]);
    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 1 })).toEqual([
      expect.objectContaining({
        source_column: 12,
        urls: ["https://example.com/uci-divulgacao"],
        target_source_order: 2,
      }),
    ]);
  });

  it("não duplica evidência já associada na carga", () => {
    const response = {
      answer: "yes",
      source_order: 109,
      supporting_fields: [{
        source_column: 175,
        source_header: "Evidencie",
        text: null,
        urls: ["https://example.com/diag"],
        contributes_evidence: true,
      }],
    };
    expect(evidencePayload(response, new Set(["https://example.com/diag"]))).toEqual([]);
  });

  it("preserva link armazenado em observação/texto auxiliar e vincula ao critério", () => {
    const response = {
      answer: "yes",
      supporting_fields: [{
        source_column: 21,
        source_header: "Qual o período de vigência do Plano Estratégico?",
        text: "2024-2027",
        urls: ["https://example.com/plano-obs"],
        contributes_evidence: true,
      }],
    };
    expect(responseEvidenceUrls(response)).toEqual(["https://example.com/plano-obs"]);
    expect(buildImportedResponseNotes(response)).toContain(
      "Qual o período de vigência do Plano Estratégico?: 2024-2027",
    );
  });

  it("campo complementar importado incorretamente como critério é remapeado", () => {
    const responses = baseResponses();
    responses[109] = {
      ...responses[109],
      source_order: 110,
      answer: "no",
      supporting_fields: [
        {
          source_column: 175,
          source_header: "Caso tenha sido realizado diagnóstico...",
          text: null,
          urls: ["https://example.com/diag"],
        },
        {
          source_column: 176,
          source_header: "Caso haja registro...",
          text: null,
          urls: ["https://example.com/registro"],
        },
      ],
    };
    responses[108] = {
      ...responses[108],
      source_order: 109,
      answer: "yes",
      supporting_fields: [],
    };

    const remapped = remapManifestSupportingFields({
      schema_version: 2,
      records: [{ organization_acronym: "TESTE", responses }],
    });

    const r109 = remapped.records[0].responses[108];
    const r110 = remapped.records[0].responses[109];
    expect(r109.supporting_fields.map((field) => field.source_column)).toEqual([175]);
    expect(responseEvidenceUrls(r109)).toEqual(["https://example.com/diag"]);
    expect(r110.supporting_fields.map((field) => field.source_column)).toEqual([176]);
    expect(responseEvidenceUrls(r110)).toEqual([]);
    expect(r109.validation_status).toBe("approved");
  });

  it("reexecução do remapeamento não duplica supporting_fields nem URLs", () => {
    const responses = baseResponses();
    responses[108] = {
      ...responses[108],
      answer: "yes",
      supporting_fields: [{
        source_column: 175,
        source_header: "Diagnóstico",
        text: null,
        urls: ["https://example.com/diag"],
      }],
    };
    const first = remapManifestSupportingFields({
      records: [{ organization_acronym: "TESTE", responses }],
    });
    const second = remapManifestSupportingFields(structuredClone(first));
    expect(second.records[0].responses[108].supporting_fields).toHaveLength(1);
    expect(responseEvidenceUrls(second.records[0].responses[108])).toEqual([
      "https://example.com/diag",
    ]);
  });

  it("campo órfão não vira evidência ativa do critério vizinho", () => {
    const responses = baseResponses();
    responses[60] = {
      ...responses[60],
      source_order: 61,
      answer: "yes",
      supporting_fields: [{
        source_column: 108,
        source_header: "Evidencie canal de transparência passiva",
        text: null,
        urls: ["https://example.com/passiva"],
      }],
    };
    const remapped = remapManifestSupportingFields({
      records: [{ organization_acronym: "TESTE", responses }],
    });
    const response = remapped.records[0].responses[60];
    expect(response.supporting_fields[0].contributes_evidence).toBe(false);
    expect(responseEvidenceUrls(response)).toEqual([]);
    expect(orphanEvidenceUrls(remapped.records[0])).toEqual(["https://example.com/passiva"]);
    expect(expectedEvidenceLinksBySourceOrder(remapped.records[0]).has(61)).toBe(false);
  });

  it("campo compartilhado liga a dois critérios principais", () => {
    expect(targetSourceOrdersForSupportingColumn(194)).toEqual([120, 121]);
    const headers = headersWith({
      194: "Em caso de resposta afirmativa, comprove a Due Diligence trabalhista.",
    });
    const row = blankRow(headers.length);
    row[193] = { value: "https://example.com/dd", hyperlinks: [] };
    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 119 })[0].urls).toEqual([
      "https://example.com/dd",
    ]);
    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 120 })[0].urls).toEqual([
      "https://example.com/dd",
    ]);
  });
});
