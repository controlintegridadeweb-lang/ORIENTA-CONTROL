import { describe, expect, it } from "vitest";
import type { ActionPlanDocument } from "./domain-model";
import { hasValidExecutionEvidence, isValidExecutionEvidence } from "./execution-evidence-policy";

function document(overrides: Partial<ActionPlanDocument> = {}): ActionPlanDocument {
  return {
    id: "doc-1",
    actionRevision: 2,
    kind: "file",
    title: "Comprovação",
    externalLink: null,
    originalFilename: "evidencia.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    fileValidationStatus: "valid",
    validatedAt: "2026-08-21T10:00:00.000Z",
    createdAt: "2026-08-21T09:00:00.000Z",
    isCurrentRevision: true,
    ...overrides,
  };
}

describe("execution-evidence-policy", () => {
  it("aceita arquivo válido da revisão atual", () => {
    expect(isValidExecutionEvidence(document())).toBe(true);
  });

  it("aceita link ativo da revisão atual", () => {
    expect(
      isValidExecutionEvidence(
        document({
          kind: "link",
          externalLink: "https://example.gov.br/comprovacao",
          originalFilename: null,
          fileValidationStatus: "not_applicable",
        }),
      ),
    ).toBe(true);
  });

  it("rejeita arquivo inválido, removido ou de revisão anterior", () => {
    expect(hasValidExecutionEvidence([document({ fileValidationStatus: "rejected" })])).toBe(false);
    expect(hasValidExecutionEvidence([document({ fileValidationStatus: "removed" })])).toBe(false);
    expect(hasValidExecutionEvidence([document({ isCurrentRevision: false })])).toBe(false);
  });
});
