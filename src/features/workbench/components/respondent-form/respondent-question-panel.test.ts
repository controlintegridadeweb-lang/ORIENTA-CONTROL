// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSubmitYesWithEvidence,
  effectiveAnswerSelection,
  RespondentSectionQuestions,
  shouldShowEvidenceUI,
  shouldShowNaJustificationUI,
} from "./respondent-question-panel";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";

afterEach(() => {
  cleanup();
});

function baseRow(overrides: Partial<WorkbenchRow> = {}): WorkbenchRow {
  return {
    questionId: "q1",
    prompt: "Pergunta?",
    requiresEvidence: true,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Eixo",
    sectionName: "Secao",
    responseId: null,
    answer: null,
    notes: null,
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    externalLink: null,
    storagePath: null,
    textBody: null,
    validationStatus: null,
    validationJustification: null,
    isNotApplicable: false,
    naJustification: null,
    naValidationStatus: null,
    naRejectionReason: null,
    ...overrides,
  };
}

describe("effectiveAnswerSelection", () => {
  it("usa a resposta salva quando não há Sim pendente", () => {
    expect(
      effectiveAnswerSelection(baseRow({ answer: "not_applicable" })),
    ).toBe("not_applicable");
  });

  it("prioriza Sim pendente e não mantém a resposta anterior selecionada", () => {
    expect(
      effectiveAnswerSelection(baseRow({ answer: "not_applicable" }), {
        pendingYes: true,
      }),
    ).toBe("yes");
    expect(
      effectiveAnswerSelection(baseRow({ answer: "no" }), { pendingYes: true }),
    ).toBe("yes");
  });

  it("prioriza N/A pendente sobre a resposta salva", () => {
    expect(
      effectiveAnswerSelection(baseRow({ answer: "no" }), { pendingNa: true }),
    ).toBe("not_applicable");
  });

  it("retorna null quando ainda não há resposta nem pendência", () => {
    expect(effectiveAnswerSelection(baseRow())).toBeNull();
  });
});

describe("shouldShowNaJustificationUI", () => {
  it("mostra com N/A salvo ou pendente local", () => {
    expect(
      shouldShowNaJustificationUI(baseRow({ answer: "not_applicable" })),
    ).toBe(true);
    expect(shouldShowNaJustificationUI(baseRow(), { pendingNa: true })).toBe(
      true,
    );
  });

  it("esconde sem N/A", () => {
    expect(shouldShowNaJustificationUI(baseRow({ answer: "yes" }))).toBe(false);
  });
});

describe("shouldShowEvidenceUI", () => {
  it("shows when Sim is saved and requires evidence", () => {
    expect(shouldShowEvidenceUI(baseRow({ answer: "yes" }))).toBe(true);
  });

  it("shows when Sim is pending locally", () => {
    expect(shouldShowEvidenceUI(baseRow(), { pendingYes: true })).toBe(true);
  });

  it("hides before Sim is chosen", () => {
    expect(shouldShowEvidenceUI(baseRow())).toBe(false);
  });
});

describe("canSubmitYesWithEvidence", () => {
  it("allows Sim without draft when question does not require evidence", () => {
    expect(
      canSubmitYesWithEvidence(baseRow({ requiresEvidence: false }), {
        kind: null,
        title: "",
        description: "",
        externalLink: "",
        storagePath: null,
        pendingUploadId: null,
        textBody: "",
      }),
    ).toBe(true);
  });

  it("allows Sim without evidence so the absence is diagnosed later", () => {
    expect(
      canSubmitYesWithEvidence(baseRow(), {
        kind: null,
        title: "",
        description: "",
        externalLink: "",
        storagePath: null,
        pendingUploadId: null,
        textBody: "",
      }),
    ).toBe(true);
  });

  it("blocks Sim when file exists but title is empty", () => {
    expect(
      canSubmitYesWithEvidence(baseRow(), {
        kind: "file",
        title: "",
        description: "",
        externalLink: "",
        storagePath: "org/form/a.pdf",
        pendingUploadId: "pending-upload-1",
        textBody: "",
      }),
    ).toBe(false);
  });

  it("blocks Sim when file path exists but upload token is missing", () => {
    expect(
      canSubmitYesWithEvidence(baseRow(), {
        kind: "file",
        title: "Comprovante",
        description: "",
        externalLink: "",
        storagePath: "org/form/a.pdf",
        pendingUploadId: null,
        textBody: "",
      }),
    ).toBe(false);
  });

  it("allows Sim when file upload token and title are present", () => {
    expect(
      canSubmitYesWithEvidence(baseRow(), {
        kind: "file",
        title: "Comprovante",
        description: "",
        externalLink: "",
        storagePath: "org/form/a.pdf",
        pendingUploadId: "pending-upload-1",
        textBody: "",
      }),
    ).toBe(true);
  });

  it("allows Sim when evidence is already persisted on the server", () => {
    expect(
      canSubmitYesWithEvidence(
        baseRow({
          evidenceId: "ev-1",
          storagePath: "org/form/saved.pdf",
          evidenceTitle: "Salvo",
        }),
        {
          kind: null,
          title: "",
          description: "",
          externalLink: "",
          storagePath: null,
          pendingUploadId: null,
          textBody: "",
        },
      ),
    ).toBe(true);
  });

  it("does not pass with evidenceId only and no attachment or title", () => {
    expect(
      canSubmitYesWithEvidence(
        baseRow({ evidenceId: "ev-1", storagePath: null, externalLink: null, evidenceTitle: null }),
        {
          kind: null,
          title: "",
          description: "",
          externalLink: "",
          storagePath: null,
          pendingUploadId: null,
          textBody: "",
        },
      ),
    ).toBe(false);
  });
});


describe("RespondentSectionQuestions", () => {
  it("usa controles radio nativos para respostas mutuamente exclusivas", () => {
    render(
      createElement(RespondentSectionQuestions, {
        section: { name: "Seção", rows: [baseRow()] },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
      }),
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => radio.tagName === "INPUT")).toBe(true);
    expect(new Set(radios.map((radio) => radio.getAttribute("name"))).size).toBe(1);
  });

  it("mostra somente a mensagem de evidência aprovada sem orientação genérica", () => {
    const approvedRow = baseRow({
      answer: "yes",
      evidenceId: "ev-1",
      storagePath: "a.pdf",
      validationStatus: "approved",
    });

    render(
      createElement(RespondentSectionQuestions, {
        section: {
          name: "Seção",
          rows: [approvedRow],
        },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
        diagnosisStatus: "in_response",
      }),
    );

    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.textContent).toContain("Comprovação aprovada.");
    expect(notes[0]?.textContent).not.toMatch(/vale 1/);
    expect(screen.queryByText(/exige evidência para comprovação/)).toBeNull();
    expect(screen.queryByText(/enquanto não houver evidência aprovada/)).toBeNull();
  });

  it("não duplica mensagem genérica quando há evidência aprovada na lista", () => {
    render(
      createElement(RespondentSectionQuestions, {
        section: {
          name: "Seção",
          rows: [
            baseRow({
              answer: "yes",
              evidenceId: "ev-2",
              storagePath: "new.pdf",
              validationStatus: "submitted",
              evidences: [
                {
                  id: "ev-1",
                  kind: "file",
                  title: "Aprovada",
                  description: "",
                  externalLink: null,
                  storagePath: "ok.pdf",
                  textBody: null,
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
                  textBody: null,
                  validationStatus: "submitted",
                  validatedAt: null,
                  submittedAt: "2026-02-01",
                  validationJustification: null,
                },
              ],
            }),
          ],
        },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
      }),
    );

    expect(screen.getByRole("note").textContent).toContain("Comprovação aprovada.");
    expect(screen.queryByText(/exige evidência para comprovação/)).toBeNull();
  });

  it("com evidências na lista: banner, itens e texto de pendência ficam coerentes", () => {
    render(
      createElement(RespondentSectionQuestions, {
        section: {
          name: "Seção",
          rows: [
            baseRow({
              answer: "yes",
              evidenceId: "ev-1",
              storagePath: "org/cycle/portaria.pdf",
              validationStatus: "submitted",
              evidences: [
                {
                  id: "ev-1",
                  kind: "file",
                  title: "Portaria UCI",
                  description: "",
                  externalLink: null,
                  storagePath: "org/cycle/portaria.pdf",
                  textBody: null,
                  validationStatus: "submitted",
                  validatedAt: null,
                  submittedAt: "2026-01-01",
                  validationJustification: null,
                },
                {
                  id: "ev-2",
                  kind: "link",
                  title: "Norma publicada",
                  description: "",
                  externalLink: "https://exemplo.gov.br/norma",
                  storagePath: null,
                  textBody: null,
                  validationStatus: "submitted",
                  validatedAt: null,
                  submittedAt: "2026-01-02",
                  validationJustification: null,
                },
              ],
            }),
          ],
        },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
      }),
    );

    expect(screen.getByRole("note").textContent).toContain(
      "Evidência enviada e aguardando validação.",
    );
    expect(screen.getByLabelText("Evidências salvas").textContent).toContain("Portaria UCI");
    expect(screen.getByLabelText("Evidências salvas").textContent).toContain(
      "Norma publicada",
    );
    expect(
      screen.getByText(
        /Evidência enviada e aguardando validação\. Você pode consultar ou gerenciar/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(/Envie um ou mais arquivos ou informe um link/),
    ).toBeNull();
  });

  it("evidences vazia com legado válido: lista e banner usam o fallback", () => {
    render(
      createElement(RespondentSectionQuestions, {
        section: {
          name: "Seção",
          rows: [
            baseRow({
              answer: "yes",
              evidences: [],
              evidenceId: "ev-legacy",
              storagePath: "org/cycle/legado.pdf",
              evidenceTitle: "Documento legado",
              validationStatus: "submitted",
            }),
          ],
        },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
      }),
    );

    expect(screen.getByRole("note").textContent).toContain(
      "Evidência enviada e aguardando validação.",
    );
    expect(screen.getByLabelText("Evidências salvas").textContent).toContain(
      "Documento legado",
    );
  });

  it("sem evidência válida: não mostra enviada e exibe texto de envio inicial", () => {
    render(
      createElement(RespondentSectionQuestions, {
        section: {
          name: "Seção",
          rows: [
            baseRow({
              answer: "yes",
              evidences: [],
              evidenceId: "ev-residual",
              storagePath: null,
              externalLink: null,
            }),
          ],
        },
        sectionIndex: 0,
        stepLabel: "Seção 1 de 1",
        evidenceDrafts: {},
        onEvidenceDraftChange: vi.fn(),
        onEvidenceKindChange: vi.fn(),
        onFileSelected: vi.fn(),
        onSelectAnswer: vi.fn(),
      }),
    );

    expect(screen.getByRole("note").textContent).toContain(
      "Resposta positiva sem comprovação.",
    );
    expect(screen.queryByLabelText("Evidências salvas")).toBeNull();
    expect(
      screen.getByText(
        "Envie um ou mais arquivos ou informe um link. Cada evidência precisa de um título próprio.",
      ),
    ).toBeTruthy();
  });
});
