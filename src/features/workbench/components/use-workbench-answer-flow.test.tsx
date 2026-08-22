// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { Row, WorkbenchPayload } from "./workbench-helpers";
import type { WorkbenchFeedback } from "./workbench-types";
import { AUTOSAVE_TEXT_DEBOUNCE_MS } from "./criterion-answer-autosave";

const mocks = vi.hoisted(() => ({
  submitWorkbenchResponse: vi.fn(),
  submitWorkbenchResponses: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/infrastructure/client/workbench-api", () => ({
  submitWorkbenchResponse: mocks.submitWorkbenchResponse,
  submitWorkbenchResponses: mocks.submitWorkbenchResponses,
}));

vi.mock("@/features/improvement-management", () => ({
  invalidateRespondentOverviewCache: vi.fn(),
}));

vi.mock("@/features/improvement-management/action-plans", () => ({
  invalidateRespondentOverviewCache: vi.fn(),
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

vi.mock("@/infrastructure/observability/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { useWorkbenchAnswerFlow } from "./use-workbench-answer-flow";

const baseRow: Row = {
  questionId: "11111111-1111-4111-8111-111111111111",
  prompt: "A organização possui uma política?",
  requiresEvidence: true,
  famiEnabled: true,
  recommendationText: "",
  axisName: "Governança",
  sectionName: "Seção",
  responseId: null,
  answer: null,
  notes: null,
  isNotApplicable: false,
  naJustification: null,
  naValidationStatus: null,
  naRejectionReason: null,
  evidenceId: null,
  evidenceTitle: null,
  evidenceDescription: null,
  externalLink: null,
  storagePath: null,
  validationStatus: null,
  validationJustification: null,
};

function okResponse(answer: "yes" | "no" | "not_applicable", revision = 1) {
  const body = {
    response: {
      id: "22222222-2222-4222-8222-222222222222",
      answer,
      notes:
        answer === "not_applicable"
          ? "Justificativa com mais de vinte caracteres."
          : "",
      revision,
    },
  };
  const text = JSON.stringify(body);
  return {
    ok: true,
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockResolvedValue(body),
  };
}

function renderAnswerFlow(options?: {
  evidenceDrafts?: Record<string, EvidenceDraft>;
  loadWorkbench?: () => Promise<boolean>;
  setFeedback?: Mock<(value: SetStateAction<WorkbenchFeedback | null>) => void>;
  setData?: Mock<(value: SetStateAction<WorkbenchPayload | null>) => void>;
  rows?: Row[];
}) {
  const setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>> =
    options?.setFeedback ?? vi.fn();
  const setData: Dispatch<SetStateAction<WorkbenchPayload | null>> =
    options?.setData ?? vi.fn();
  const setSavingQuestionId: Dispatch<SetStateAction<string | null>> = vi.fn();
  const loadWorkbench = options?.loadWorkbench ?? (async () => true);
  const rows = options?.rows ?? [baseRow];
  const resolveRow = (questionId: string) =>
    rows.find((row) => row.questionId === questionId);

  return renderHook(() =>
    useWorkbenchAnswerFlow({
      ids: { cycleId: "33333333-3333-4333-8333-333333333333" },
      mode: "respondent",
      simplifiedRespondent: true,
      evidenceDrafts: options?.evidenceDrafts ?? {},
      discardPendingUpload: vi.fn().mockResolvedValue(true),
      clearEvidenceDraft: vi.fn(),
      loadWorkbench,
      setData,
      setFeedback,
      setSavingQuestionId,
      resolveRow,
    }),
  );
}

describe("useWorkbenchAnswerFlow autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.submitWorkbenchResponse.mockReset().mockResolvedValue(okResponse("yes"));
    mocks.submitWorkbenchResponses.mockReset();
    mocks.success.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não dispara persistência na montagem inicial", () => {
    renderAnswerFlow();
    expect(mocks.submitWorkbenchResponse).not.toHaveBeenCalled();
  });

  it("selecionar Sim salva automaticamente mesmo quando exige evidência", async () => {
    const { result } = renderAnswerFlow();

    await act(async () => {
      await result.current.handleSelectAnswer(baseRow, "yes");
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledTimes(1);
    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledWith(
      { cycleId: "33333333-3333-4333-8333-333333333333" },
      expect.objectContaining({
        questionId: baseRow.questionId,
        answer: "yes",
      }),
    );
    expect(result.current.pendingYesQuestionIds.has(baseRow.questionId)).toBe(true);
    expect(result.current.autosaveStatuses[baseRow.questionId]?.status).toBe("saved");
  });

  it("selecionar Não salva automaticamente", async () => {
    mocks.submitWorkbenchResponse.mockResolvedValue(okResponse("no"));
    const { result } = renderAnswerFlow();

    await act(async () => {
      await result.current.handleSelectAnswer(
        { ...baseRow, requiresEvidence: false },
        "no",
      );
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ answer: "no" }),
    );
  });

  it("Não se aplica sem justificativa válida não persiste", async () => {
    const { result } = renderAnswerFlow();

    await act(async () => {
      await result.current.handleSelectAnswer(baseRow, "not_applicable");
    });

    expect(mocks.submitWorkbenchResponse).not.toHaveBeenCalled();
    expect(result.current.pendingNaQuestionIds.has(baseRow.questionId)).toBe(true);
  });

  it("Não se aplica com justificativa válida salva automaticamente", async () => {
    mocks.submitWorkbenchResponse.mockResolvedValue(okResponse("not_applicable"));
    const { result } = renderAnswerFlow();
    const justification = "Justificativa com mais de vinte caracteres.";

    await act(async () => {
      result.current.updateNaJustification(baseRow.questionId, justification);
    });
    await act(async () => {
      await result.current.handleSelectAnswer(baseRow, "not_applicable");
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        answer: "not_applicable",
        notes: justification,
      }),
    );
  });

  it("campo textual de N/A respeita debounce antes de salvar", async () => {
    mocks.submitWorkbenchResponse.mockResolvedValue(okResponse("not_applicable"));
    const row: Row = {
      ...baseRow,
      answer: "not_applicable",
      naJustification: null,
    };
    const { result } = renderAnswerFlow({ rows: [row] });
    const justification = "Justificativa com mais de vinte caracteres.";

    await act(async () => {
      result.current.updateNaJustification(row.questionId, justification);
    });
    expect(mocks.submitWorkbenchResponse).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_TEXT_DEBOUNCE_MS);
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledTimes(1);
  });

  it("não salva novamente quando a resposta não mudou", async () => {
    mocks.submitWorkbenchResponse.mockResolvedValue(okResponse("no"));
    const row: Row = {
      ...baseRow,
      requiresEvidence: false,
      answer: "no",
      responseId: "22222222-2222-4222-8222-222222222222",
      responseRevision: 3,
      notes: "",
    };
    const { result } = renderAnswerFlow({ rows: [row] });

    await act(async () => {
      await result.current.handleSelectAnswer(row, "no");
    });

    expect(mocks.submitWorkbenchResponse).not.toHaveBeenCalled();
  });

  it("requisição antiga não sobrescreve a alteração mais recente", async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    mocks.submitWorkbenchResponse
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValueOnce(okResponse("no", 2));

    const row: Row = { ...baseRow, requiresEvidence: false };
    const { result } = renderAnswerFlow({ rows: [row] });

    await act(async () => {
      void result.current.handleSelectAnswer(row, "yes");
    });
    await act(async () => {
      await result.current.handleSelectAnswer(row, "no");
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.(okResponse("yes", 1));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledTimes(2);
    expect(mocks.submitWorkbenchResponse.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ answer: "no", expectedRevision: 1 }),
    );
    expect(result.current.autosaveStatuses[row.questionId]?.status).toBe("saved");
  });

  it("erro de rede apresenta estado de erro e nova tentativa persiste", async () => {
    mocks.submitWorkbenchResponse
      .mockRejectedValueOnce(new Error("Falha de rede"))
      .mockResolvedValueOnce(okResponse("no"));

    const row: Row = { ...baseRow, requiresEvidence: false };
    const { result } = renderAnswerFlow({ rows: [row] });

    await act(async () => {
      await result.current.handleSelectAnswer(row, "no");
    });

    expect(result.current.autosaveStatuses[row.questionId]?.status).toBe("error");

    await act(async () => {
      await result.current.retryAutosave(row.questionId);
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledTimes(2);
    expect(result.current.autosaveStatuses[row.questionId]?.status).toBe("saved");
  });

  it("salva evidência pela ação explícita sem toast em fluxo comum", async () => {
    const { result } = renderAnswerFlow({
      evidenceDrafts: {
        [baseRow.questionId]: {
          kind: "link",
          title: "Política publicada",
          description: "",
          externalLink: "https://example.com/politica",
          storagePath: null,
          pendingUploadId: null,
          textBody: "",
        },
      },
    });

    await act(async () => {
      await result.current.saveYesWithEvidence(baseRow);
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledWith(
      { cycleId: "33333333-3333-4333-8333-333333333333" },
      expect.objectContaining({
        questionId: baseRow.questionId,
        answer: "yes",
        evidence: expect.objectContaining({
          kind: "link",
          title: "Política publicada",
          externalLink: "https://example.com/politica",
        }),
      }),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("confirma o salvamento de uma correção antes do avanço automático", async () => {
    const adjustmentRow: Row = {
      ...baseRow,
      answer: "yes",
      hasAdjustmentRequest: true,
      adjustmentRequestCount: 1,
      unresolvedAdjustmentRequestCount: 1,
    };
    const { result } = renderAnswerFlow({
      evidenceDrafts: {
        [baseRow.questionId]: {
          kind: "link",
          title: "Política corrigida",
          description: "Versão atualizada",
          externalLink: "https://example.com/politica-atualizada",
          storagePath: null,
          pendingUploadId: null,
          textBody: "",
        },
      },
    });

    await act(async () => {
      await result.current.saveYesWithEvidence(adjustmentRow);
    });

    expect(mocks.success).toHaveBeenCalledWith("Correção salva com sucesso.");
  });

  it("mantém aviso quando a resposta salva não pode ser recarregada após evidência", async () => {
    const setFeedback = vi.fn();
    const loadWorkbench = vi.fn().mockResolvedValue(false);
    const { result } = renderAnswerFlow({
      setFeedback,
      loadWorkbench,
      evidenceDrafts: {
        [baseRow.questionId]: {
          kind: "link",
          title: "Política publicada",
          description: "",
          externalLink: "https://example.com/politica",
          storagePath: null,
          pendingUploadId: null,
          textBody: "",
        },
      },
    });

    await act(async () => {
      await result.current.saveYesWithEvidence(baseRow);
    });

    expect(loadWorkbench).toHaveBeenCalledTimes(1);
    expect(setFeedback).toHaveBeenCalledWith({
      tone: "warning",
      title: "Resposta salva, mas a tela não foi atualizada",
      description:
        "Os dados foram registrados. Recarregue o diagnóstico para visualizar o estado mais recente.",
      retryAction: "reload",
    });
  });

  it("atualiza o registro existente sem criar fluxo de envio definitivo", async () => {
    mocks.submitWorkbenchResponse.mockResolvedValue(okResponse("yes", 4));
    const row: Row = {
      ...baseRow,
      requiresEvidence: false,
      answer: "no",
      responseId: "22222222-2222-4222-8222-222222222222",
      responseRevision: 3,
    };
    const setData = vi.fn();
    const { result } = renderAnswerFlow({ rows: [row], setData });

    await act(async () => {
      await result.current.handleSelectAnswer(row, "yes");
    });

    expect(mocks.submitWorkbenchResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        answer: "yes",
        expectedRevision: 3,
      }),
    );
    expect(mocks.submitWorkbenchResponses).not.toHaveBeenCalled();
    expect(setData).toHaveBeenCalled();
  });
});
