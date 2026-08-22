import { describe, expect, it } from "vitest";
import {
  RAW_ANSWER_COLUMNS,
  canonicalOrganizationAcronym,
  extractUrls,
  normalizeHistoricalAnswer,
  supportingFieldsForQuestion,
} from "./diagnostic-integrity-2026-workbook.mjs";

describe("planilha histórica do Diagnóstico de Integridade 2026", () => {
  it("mantém o mapeamento dos 126 critérios", () => {
    expect(RAW_ANSWER_COLUMNS).toHaveLength(126);
    expect(new Set(RAW_ANSWER_COLUMNS).size).toBe(126);
  });

  it("normaliza respostas integrais e parciais sem inventar dados", () => {
    expect(normalizeHistoricalAnswer("Sim").answer).toBe("yes");
    expect(normalizeHistoricalAnswer("Parcialmente").answer).toBe("no");
    expect(normalizeHistoricalAnswer("")).toMatchObject({ answer: "no", inferred: true });
  });

  it("resolve a sigla canônica do órgão", () => {
    expect(canonicalOrganizationAcronym("Secretaria de Estado da Saúde Pública - SESAP")).toBe("SESAP");
  });

  it("extrai URLs sem duplicação", () => {
    expect(extractUrls("https://example.com/a; https://example.com/a")).toEqual([
      "https://example.com/a",
    ]);
  });

  it("preserva texto e hyperlink nas colunas auxiliares", () => {
    const headers = Array.from({ length: 10 }, () => ({ value: "" }));
    const row = Array.from({ length: 10 }, () => ({ value: "", hyperlinks: [] }));
    headers[8] = { value: "Comprovação" };
    row[8] = { value: "Ato normativo", hyperlinks: ["https://example.com/ato"] };
    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 0 })).toEqual([{
      source_column: 9,
      source_header: "Comprovação",
      text: "Ato normativo",
      urls: ["https://example.com/ato"],
      contributes_evidence: true,
      target_source_order: 1,
    }]);
  });

  it("não atribui evidência por intervalo posicional entre respostas consecutivas", () => {
    const headers = Array.from({ length: 180 }, () => ({ value: "" }));
    const row = Array.from({ length: 180 }, () => ({ value: "", hyperlinks: [] }));
    for (const column of RAW_ANSWER_COLUMNS) {
      headers[column - 1] = { value: `Resposta ${column}` };
    }
    headers[174] = {
      value:
        "Caso tenha sido realizado diagnóstico no âmbito do órgão ou entidade, evidencie sua realização mediante a apresentação dos documentos correspondentes.",
    };
    row[174] = {
      value: "https://example.com/diagnostico",
      hyperlinks: ["https://example.com/diagnostico"],
    };

    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 108 })).toEqual([
      expect.objectContaining({
        source_column: 175,
        target_source_order: 109,
        urls: ["https://example.com/diagnostico"],
      }),
    ]);
    expect(supportingFieldsForQuestion({ headers, row, questionIndex: 109 })).toEqual([]);
  });
});
