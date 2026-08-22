import { describe, expect, it } from "vitest";
import {
  buildImportedResponseNotes,
  evidencePayload,
  expectedEvidenceValidationStatus,
  responseEvidenceUrls,
  validateDiagnosticImportManifest,
} from "./diagnostic-response-import.mjs";

function manifestFixture() {
  return {
    schema_version: 2,
    form_name: "Diagnóstico de Integridade 2026",
    period_label: "Diagnóstico de Integridade 2026",
    questions: Array.from({ length: 126 }, (_, index) => ({
      source_order: index + 1,
      prompt: `Pergunta ${index + 1}`,
      requires_evidence: index === 0,
      raw_answer_column: index + 8,
    })),
    records: [{
      organization_acronym: "TESTE",
      submitted_at_source: "2026-01-01T10:00:00-03:00",
      respondent: {
        full_name: "Pessoa Teste",
        registration_number: "123",
        organizational_unit: "Unidade",
        position_title: "Cargo",
        declaration: "Concordo",
      },
      waivers: [],
      responses: Array.from({ length: 126 }, (_, index) => ({
        source_order: index + 1,
        answer: index === 0 ? "yes" : "no",
        answer_original: index === 0 ? "Sim" : "Não",
        requires_evidence: index === 0,
        validation_status: index === 0 ? "approved" : null,
        supporting_fields: index === 0 ? [{
          source_column: 11,
          source_header: "Comprovação",
          text: "Documento",
          urls: ["https://example.com/evidencia"],
        }] : [],
        inferred: false,
        override: null,
      })),
    }],
  };
}

describe("manifesto de respostas históricas", () => {
  it("valida 126 critérios binários no contrato v2", () => {
    expect(validateDiagnosticImportManifest(manifestFixture()).records).toHaveLength(1);
  });

  it("não transforma links de resposta Não em evidências ativas", () => {
    const response = manifestFixture().records[0].responses[0];
    response.answer = "no";
    expect(responseEvidenceUrls(response)).toEqual([]);
  });

  it("preserva links de resposta Não nas notas históricas", () => {
    const response = manifestFixture().records[0].responses[0];
    response.answer = "no";
    expect(buildImportedResponseNotes(response)).toContain(
      "Comprovação — referência informada: https://example.com/evidencia",
    );
  });

  it("remove links já cadastrados do lote", () => {
    const response = manifestFixture().records[0].responses[0];
    expect(evidencePayload(response, new Set(["https://example.com/evidencia"]))).toEqual([]);
  });

  it("preserva justificativas e textos auxiliares nas notas", () => {
    const response = manifestFixture().records[0].responses[0];
    response.inferred = true;
    response.normalization_reason = "Inferência auditável.";
    expect(buildImportedResponseNotes(response)).toContain("Inferência auditável.");
    expect(buildImportedResponseNotes(response)).toContain("Comprovação: Documento");
  });

  it("aplica parecer a qualquer evidência histórica importável", () => {
    const response = manifestFixture().records[0].responses[0];
    response.requires_evidence = false;
    expect(expectedEvidenceValidationStatus(response)).toBe("approved");
    response.supporting_fields = [];
    expect(expectedEvidenceValidationStatus(response)).toBeNull();
  });
});
