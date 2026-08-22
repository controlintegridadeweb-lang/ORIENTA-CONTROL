import { describe, expect, it } from "vitest";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import {
  resolveEvidenceStatus,
  resolveEvidenceStatusMessage,
} from "./evidence-rule-message";

function row(
  overrides: Partial<WorkbenchRow> = {},
): Pick<
  WorkbenchRow,
  | "evidenceId"
  | "evidenceTitle"
  | "evidenceDescription"
  | "storagePath"
  | "externalLink"
  | "textBody"
  | "validationStatus"
  | "validationJustification"
  | "hasAdjustmentRequest"
  | "evidences"
> {
  return {
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    storagePath: null,
    externalLink: null,
    textBody: null,
    validationStatus: null,
    validationJustification: null,
    hasAdjustmentRequest: false,
    evidences: undefined,
    ...overrides,
  };
}

describe("resolveEvidenceStatus", () => {
  it("retorna not_submitted sem evidência persistida", () => {
    expect(resolveEvidenceStatus(row())).toBe("not_submitted");
  });

  it("retorna not_submitted quando evidences é [] sem legado válido", () => {
    expect(resolveEvidenceStatus(row({ evidences: [] }))).toBe("not_submitted");
  });

  it("retorna pending quando há anexo sem veredito", () => {
    expect(
      resolveEvidenceStatus(row({ evidenceId: "ev-1", storagePath: "a.pdf" })),
    ).toBe("pending");
  });

  it("retorna pending via fallback quando evidences é [] com legado válido", () => {
    expect(
      resolveEvidenceStatus(
        row({
          evidences: [],
          evidenceId: "ev-1",
          storagePath: "a.pdf",
          evidenceTitle: "Arquivo",
        }),
      ),
    ).toBe("pending");
  });

  it("não marca pending só com evidenceId residual incompleto", () => {
    expect(
      resolveEvidenceStatus(
        row({
          evidences: [],
          evidenceId: "ev-1",
          storagePath: null,
          externalLink: null,
        }),
      ),
    ).toBe("not_submitted");
  });

  it("retorna approved pelo validationStatus da evidência resolvida", () => {
    expect(
      resolveEvidenceStatus(
        row({ evidenceId: "ev-1", storagePath: "a.pdf", validationStatus: "approved" }),
      ),
    ).toBe("approved");
  });

  it("prioriza approved quando ao menos uma evidência da lista está aprovada", () => {
    expect(
      resolveEvidenceStatus(
        row({
          evidenceId: "ev-2",
          validationStatus: "submitted",
          evidences: [
            {
              id: "ev-1",
              kind: "file",
              title: "Antiga",
              description: "",
              externalLink: null,
              storagePath: "old.pdf",
              validationStatus: "approved",
              validatedAt: "2026-01-01",
              submittedAt: "2026-01-01",
              validationJustification: null,
            },
            {
              id: "ev-2",
              kind: "file",
              title: "Nova",
              description: "",
              externalLink: null,
              storagePath: "new.pdf",
              validationStatus: "submitted",
              validatedAt: null,
              submittedAt: "2026-02-01",
              validationJustification: null,
            },
          ],
        }),
      ),
    ).toBe("approved");
  });

  it("retorna insufficient quando a evidência foi invalidada", () => {
    expect(
      resolveEvidenceStatus(
        row({ evidenceId: "ev-1", storagePath: "a.pdf", validationStatus: "invalidated" }),
      ),
    ).toBe("insufficient");
  });

  it("retorna rejected quando há devolutiva de ajuste com evidência válida", () => {
    expect(
      resolveEvidenceStatus(
        row({
          evidenceId: "ev-1",
          storagePath: "a.pdf",
          validationStatus: "adjustment_requested",
          hasAdjustmentRequest: true,
        }),
      ),
    ).toBe("rejected");
  });

  it("retorna not_submitted com hasAdjustmentRequest sem evidência válida", () => {
    expect(
      resolveEvidenceStatus(
        row({
          evidences: [],
          hasAdjustmentRequest: true,
        }),
      ),
    ).toBe("not_submitted");
  });
});

describe("resolveEvidenceStatusMessage", () => {
  it("não renderiza quando a pergunta não exige evidência", () => {
    expect(
      resolveEvidenceStatusMessage({
        answer: "yes",
        evidenceRequired: false,
        evidenceStatus: "not_submitted",
      }),
    ).toBeNull();
  });

  it("não renderiza orientação genérica quando a resposta não é Sim", () => {
    expect(
      resolveEvidenceStatusMessage({
        answer: null,
        evidenceRequired: true,
        evidenceStatus: "not_submitted",
      }),
    ).toBeNull();
  });

  it("informa Sim sem comprovação sem detalhar pontuação FAMI", () => {
    const message = resolveEvidenceStatusMessage({
      answer: "yes",
      evidenceRequired: true,
      evidenceStatus: "not_submitted",
    });

    expect(message?.title).toBe("Resposta positiva sem comprovação.");
    expect(message?.body).toBeUndefined();
  });

  it("informa aguardando validação sem detalhar pontuação FAMI", () => {
    const message = resolveEvidenceStatusMessage({
      answer: "yes",
      evidenceRequired: true,
      evidenceStatus: "pending",
    });

    expect(message?.title).toBe("Evidência enviada e aguardando validação.");
    expect(message?.body).toBeUndefined();
  });

  it("informa aguardando validação com copy textual quando só há texto", () => {
    const message = resolveEvidenceStatusMessage({
      answer: "yes",
      evidenceRequired: true,
      evidenceStatus: "pending",
      pendingModality: "text",
    });

    expect(message?.title).toBe(
      "Comprovação textual enviada e aguardando validação.",
    );
    expect(message?.body).toBeUndefined();
  });

  it("informa evidência aprovada sem detalhar pontuação FAMI", () => {
    const message = resolveEvidenceStatusMessage({
      answer: "yes",
      evidenceRequired: true,
      evidenceStatus: "approved",
    });

    expect(message?.title).toBe("Comprovação aprovada.");
    expect(message?.body).toBeUndefined();
  });

  it("informa evidência insuficiente sem comparar com Não se aplica", () => {
    const message = resolveEvidenceStatusMessage({
      answer: "yes",
      evidenceRequired: true,
      evidenceStatus: "insufficient",
    });

    expect(message?.title).toBe("Comprovação considerada insuficiente.");
    expect(message?.body).toBeUndefined();
  });
});
