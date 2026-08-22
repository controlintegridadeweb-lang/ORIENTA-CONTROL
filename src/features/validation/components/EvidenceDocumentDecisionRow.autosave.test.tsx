// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueEvidence } from "@/features/validation/queue-model";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  saveSelection: vi.fn(),
  saveTextDebounced: vi.fn(),
  flushTarget: vi.fn().mockResolvedValue(undefined),
  clearDraftMemory: vi.fn(),
  rememberDraft: vi.fn(),
  getStatus: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/infrastructure/notifications/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/notifications/notify")>();
  return {
    ...actual,
    notify: {
      ...actual.notify,
      success: mocks.success,
    },
  };
});

vi.mock("./validation-draft-autosave-context", () => ({
  useOptionalValidationDraftAutosave: () => ({
    rememberDraft: mocks.rememberDraft,
    clearDraftMemory: mocks.clearDraftMemory,
    saveSelection: mocks.saveSelection,
    saveTextDebounced: mocks.saveTextDebounced,
    flushTarget: mocks.flushTarget,
    flushAll: vi.fn(),
    retry: mocks.retry,
    getStatus: mocks.getStatus,
    hasUnconfirmedAutosave: false,
  }),
}));

import { EvidenceDocumentDecisionRow } from "./EvidenceDocumentDecisionRow";

function makeEvidence(
  over: Partial<QueueEvidence> & { id: string } = { id: "evidence-1" },
): QueueEvidence {
  return {
    responseId: "response-1",
    questionPrompt: "Existe política?",
    sectionId: "section-1",
    sectionName: "Integridade",
    sectionOrder: 0,
    axisId: "axis-1",
    axisName: "Governança",
    orderIndex: 0,
    kind: "file",
    fileName: "politica.pdf",
    externalLink: null,
    linkReason: null,
    submittedAt: "2026-07-28T15:30:00.000Z",
    status: "pending",
    justification: null,
    answer: "yes",
    respondentNote: null,
    answeredByName: "Mauricio",
    answeredAt: "2026-07-28T15:30:00.000Z",
    ...over,
  };
}

describe("EvidenceDocumentDecisionRow autosave", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushTarget.mockResolvedValue(undefined);
  });

  it("salva rascunho ao selecionar decisão sem chamar Confirmar", async () => {
    const onVerdict = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceDocumentDecisionRow
        document={makeEvidence()}
        onVerdict={onVerdict}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aprovar evidência" }));

    await waitFor(() =>
      expect(mocks.saveSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          targetKind: "evidence",
          evidenceId: "evidence-1",
          action: "approve",
        }),
      ),
    );
    expect(onVerdict).not.toHaveBeenCalled();
  });

  it("hidrata rascunho persistido sem disparar save na montagem", () => {
    render(
      <EvidenceDocumentDecisionRow
        document={makeEvidence({
          id: "evidence-1",
          analysisDraft: {
            id: "draft-1",
            action: "invalidate",
            justification: "Evidência insuficiente",
            notes: null,
            revision: 2,
            updatedAt: "2026-08-04T12:00:00.000Z",
          },
        })}
        onVerdict={vi.fn()}
        disabled={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Considerar insuficiente" })).toBeTruthy();
    expect(
      screen.getByDisplayValue("Evidência insuficiente"),
    ).toBeTruthy();
    expect(mocks.saveSelection).not.toHaveBeenCalled();
    expect(mocks.saveTextDebounced).not.toHaveBeenCalled();
    expect(mocks.rememberDraft).toHaveBeenCalled();
  });

  it("no Confirmar faz flush do rascunho e aplica veredito oficial", async () => {
    const onVerdict = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceDocumentDecisionRow
        document={makeEvidence()}
        onVerdict={onVerdict}
        disabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aprovar evidência" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar: Aprovar evidência" }),
    );

    await waitFor(() => expect(mocks.flushTarget).toHaveBeenCalled());
    await waitFor(() =>
      expect(onVerdict).toHaveBeenCalledWith("evidence-1", "approve", ""),
    );
    expect(mocks.clearDraftMemory).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Evidência aprovada.");
  });

  it("rascunho incompleto não permite Confirmar", () => {
    render(
      <EvidenceDocumentDecisionRow
        document={makeEvidence()}
        onVerdict={vi.fn()}
        disabled={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Considerar insuficiente" }),
    );
    const confirm = screen.getByRole("button", {
      name: "Confirmar: Considerar insuficiente",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });
});
