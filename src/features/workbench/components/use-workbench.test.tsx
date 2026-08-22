// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkbenchPayload } from "./workbench-helpers";

const mocks = vi.hoisted(() => ({
  fetchWorkbenchData: vi.fn(),
  submitRespondentCycle: vi.fn(),
  flushPendingRowsForSubmission: vi.fn(),
  resetNavigation: vi.fn(),
  setCurrentSectionIndex: vi.fn(),
  setStepDirection: vi.fn(),
  setAdvancingSection: vi.fn(),
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
  notifyLoading: vi.fn().mockReturnValue("loading-id"),
  notifySuccess: vi.fn(),
  notifyDismiss: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
    refresh: mocks.routerRefresh,
  }),
}));

vi.mock("@/shared/ui/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/infrastructure/notifications/notify", () => ({
  describeError: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
  notify: {
    loading: mocks.notifyLoading,
    success: mocks.notifySuccess,
    dismiss: mocks.notifyDismiss,
  },
}));

vi.mock("@/infrastructure/client/workbench-api", () => ({
  fetchWorkbenchData: mocks.fetchWorkbenchData,
  submitRespondentCycle: mocks.submitRespondentCycle,
}));

vi.mock("@/features/workbench/use-workbench-navigation", () => ({
  useWorkbenchNavigation: ({ rows }: { rows: WorkbenchPayload["rows"] }) => ({
    currentSectionIndex: 0,
    setCurrentSectionIndex: mocks.setCurrentSectionIndex,
    stepDirection: "forward",
    setStepDirection: mocks.setStepDirection,
    advancingSection: false,
    setAdvancingSection: mocks.setAdvancingSection,
    groupedBySection: Array.from(
      rows.reduce((groups, row) => {
        const sectionRows = groups.get(row.sectionName) ?? [];
        sectionRows.push(row);
        groups.set(row.sectionName, sectionRows);
        return groups;
      }, new Map<string, WorkbenchPayload["rows"]>()),
      ([name, sectionRows]) => ({ name, rows: sectionRows }),
    ),
    questionFocusMode: false,
    resetNavigation: mocks.resetNavigation,
  }),
}));

vi.mock("./use-persisted-workbench-section", () => ({
  usePersistedWorkbenchSection: vi.fn(),
}));

vi.mock("./use-workbench-evidence", () => ({
  useWorkbenchEvidence: () => ({
    evidenceDrafts: {},
    uploadingQuestionId: null,
    updateEvidenceDraft: vi.fn(),
    clearEvidenceDraft: vi.fn(),
    discardPendingUpload: vi.fn().mockResolvedValue(true),
    handleRemoveEvidence: vi.fn(),
    handleEvidenceKindChange: vi.fn(),
    handleEvidenceFile: vi.fn(),
  }),
}));

vi.mock("./use-workbench-answer-flow", () => ({
  useWorkbenchAnswerFlow: () => ({
    pendingYesQuestionIds: new Set(["question-1"]),
    pendingNaQuestionIds: new Set(),
    naJustificationDrafts: {},
    naFieldErrors: {},
    evidenceFieldErrors: {},
    autosaveStatuses: {},
    hasUnconfirmedAutosave: false,
    flushTextAutosave: vi.fn(),
    updateNaJustification: vi.fn(),
    saveNaJustification: vi.fn().mockResolvedValue(true),
    saveYesWithEvidence: vi.fn().mockResolvedValue(true),
    handleSelectAnswer: vi.fn(),
    retryAutosave: vi.fn().mockResolvedValue(true),
    flushPendingRowsForSubmission: mocks.flushPendingRowsForSubmission,
    registerPendingEvidence: vi.fn(),
  }),
}));

import { useWorkbench } from "./use-workbench";

function row(input: {
  questionId: string;
  answer: "yes" | "no" | "not_applicable" | null;
  requiresEvidence?: boolean;
  sectionName?: string;
}): WorkbenchPayload["rows"][number] {
  return {
    questionId: input.questionId,
    prompt: `Pergunta ${input.questionId}`,
    requiresEvidence: input.requiresEvidence ?? false,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Governança",
    sectionName: input.sectionName ?? "Seção",
    responseId: input.answer ? `response-${input.questionId}` : null,
    answer: input.answer,
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
}

function payload(
  cycleId: string,
  rows: WorkbenchPayload["rows"],
  cycleState = "in_response",
): WorkbenchPayload {
  return {
    form: {
      id: "form-1",
      name: "Diagnóstico",
      version: 1,
      state: "published",
      responseDeadlineAt: null,
      closedAt: null,
    },
    cycle: { id: cycleId, state: cycleState },
    rows,
  };
}

function response(body: unknown, ok = true): Response {
  const text = JSON.stringify(body);
  return {
    ok,
    text: vi.fn().mockResolvedValue(text),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("useWorkbench", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    mocks.fetchWorkbenchData.mockReset();
    mocks.flushPendingRowsForSubmission.mockReset().mockResolvedValue({
      didPersist: false,
      missingAnswer: [],
      missingEvidence: [],
      nextFieldErrors: {},
      pendingEvidenceIds: new Set<string>(),
      firstPendingQuestionId: null,
    });
    mocks.resetNavigation.mockReset();
    mocks.setCurrentSectionIndex.mockReset();
    mocks.setStepDirection.mockReset();
    mocks.setAdvancingSection.mockReset();
    mocks.routerReplace.mockReset();
    mocks.routerRefresh.mockReset();
    mocks.notifyLoading.mockReset().mockReturnValue("loading-id");
    mocks.notifySuccess.mockReset();
    mocks.notifyDismiss.mockReset();
    mocks.submitRespondentCycle.mockReset();
  });

  it("encerra o loading e informa o erro quando a leitura falha por rede", async () => {
    mocks.fetchWorkbenchData.mockRejectedValueOnce(new Error("rede indisponível"));

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.feedback).toEqual({
      tone: "error",
      title: "Não foi possível carregar o diagnóstico",
      description: "rede indisponível",
      retryAction: "reload",
    });
  });

  it("ignora a resposta antiga quando uma leitura mais nova termina primeiro", async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    mocks.fetchWorkbenchData
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    let firstLoad!: Promise<boolean>;
    let secondLoad!: Promise<boolean>;
    act(() => {
      firstLoad = result.current.loadWorkbench();
      secondLoad = result.current.loadWorkbench();
    });

    await act(async () => {
      resolveSecond(response(payload("cycle-1", [row({ questionId: "new", answer: "no" })])));
      await secondLoad;
    });

    await act(async () => {
      resolveFirst(response(payload("cycle-1", [row({ questionId: "old", answer: "no" })])));
      await firstLoad;
    });

    expect(result.current.data?.rows[0]?.questionId).toBe("new");
  });

  it("recarrega o workbench quando o envio salva respostas válidas antes de encontrar pendências", async () => {
    const initial = payload("cycle-1", [
      row({ questionId: "question-1", answer: null, requiresEvidence: true }),
      row({ questionId: "question-2", answer: null }),
    ]);
    const refreshed = payload("cycle-1", [
      row({ questionId: "question-1", answer: "yes", requiresEvidence: true }),
      row({ questionId: "question-2", answer: null }),
    ]);
    mocks.fetchWorkbenchData
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(refreshed));
    mocks.flushPendingRowsForSubmission.mockResolvedValueOnce({
      didPersist: true,
      missingAnswer: ["Pergunta question-2"],
      missingEvidence: [],
      nextFieldErrors: {},
      pendingEvidenceIds: new Set<string>(),
      firstPendingQuestionId: "question-2",
    });

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => {
      await result.current.handleSubmitForm();
    });

    expect(mocks.fetchWorkbenchData).toHaveBeenCalledTimes(2);
    expect(result.current.data?.rows[0]?.answer).toBe("yes");
    expect(result.current.feedback?.tone).toBe("warning");
    expect(result.current.feedback?.title).toContain("Faltam");
  });

  it("usa o payload atualizado e reenvia a última correção no mesmo clique", async () => {
    const initial = payload(
      "cycle-1",
      [
        {
          ...row({ questionId: "question-1", answer: "yes", requiresEvidence: true }),
          hasAdjustmentRequest: true,
          unresolvedAdjustmentRequestCount: 1,
          hasResolvedAllAdjustments: false,
        },
      ],
      "awaiting_adjustment",
    );
    const refreshed = payload(
      "cycle-1",
      [
        {
          ...row({ questionId: "question-1", answer: "yes", requiresEvidence: true }),
          hasAdjustmentRequest: true,
          unresolvedAdjustmentRequestCount: 0,
          hasResolvedAllAdjustments: true,
        },
      ],
      "awaiting_adjustment",
    );
    mocks.fetchWorkbenchData
      .mockResolvedValueOnce(response(initial))
      .mockResolvedValueOnce(response(refreshed));
    mocks.flushPendingRowsForSubmission.mockResolvedValueOnce({
      didPersist: true,
      missingAnswer: [],
      missingEvidence: ["Pergunta question-1"],
      nextFieldErrors: {},
      pendingEvidenceIds: new Set<string>(),
      firstPendingQuestionId: "question-1",
    });
    mocks.submitRespondentCycle.mockResolvedValueOnce(response({}));

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
    });
    await waitFor(() => expect(result.current.data?.cycle.state).toBe("awaiting_adjustment"));

    await act(async () => {
      await result.current.handleSubmitForm();
    });

    expect(mocks.fetchWorkbenchData).toHaveBeenCalledTimes(2);
    expect(mocks.submitRespondentCycle).toHaveBeenCalledTimes(1);
    expect(result.current.feedback?.title).not.toBe(
      "Conclua todas as correções antes do reenvio",
    );
    expect(mocks.routerReplace).toHaveBeenCalledWith(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fformularios&submission=corrections",
    );
  });

  it("mantém a navegação entre seções livre sem executar validação intermediária", async () => {
    mocks.fetchWorkbenchData.mockResolvedValueOnce(
      response(
        payload("cycle-1", [
          row({ questionId: "question-a", answer: "no", sectionName: "Seção A" }),
          row({ questionId: "question-b", answer: "no", sectionName: "Seção B" }),
        ]),
      ),
    );

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
    });
    await waitFor(() => expect(result.current.groupedBySection).toHaveLength(2));
    await act(async () => {
      await result.current.handleSectionContinue();
    });

    const updateIndex = mocks.setCurrentSectionIndex.mock.calls.at(-1)?.[0] as
      | ((index: number) => number)
      | undefined;
    expect(updateIndex?.(0)).toBe(1);
    expect(mocks.flushPendingRowsForSubmission).not.toHaveBeenCalled();
  });

  it("preserva o aviso de pendências ao trocar diretamente de seção", async () => {
    mocks.fetchWorkbenchData.mockResolvedValueOnce(
      response(
        payload("cycle-1", [
          row({ questionId: "complete", answer: "no", sectionName: "Seção A" }),
          row({ questionId: "pending", answer: null, sectionName: "Seção B" }),
        ]),
      ),
    );

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
      await result.current.handleSubmitForm();
    });
    const pendingFeedback = result.current.feedback;

    act(() => {
      result.current.handleSectionSelect(1);
    });

    expect(result.current.feedback).toEqual(pendingFeedback);
  });

  it("mantém falha de envio na página e repete somente a submissão", async () => {
    mocks.fetchWorkbenchData.mockResolvedValueOnce(
      response(payload("cycle-1", [row({ questionId: "complete", answer: "no" })])),
    );
    mocks.submitRespondentCycle
      .mockResolvedValueOnce(response({ error: "serviço indisponível" }, false))
      .mockResolvedValueOnce(response({}));

    const { result } = renderHook(() =>
      useWorkbench({
        mode: "respondent",
        ids: { cycleId: "cycle-1" },
        canAutoLoad: false,
        simplifiedRespondent: true,
      }),
    );

    await act(async () => {
      await result.current.loadWorkbench();
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => {
      await result.current.handleSubmitForm();
    });

    expect(result.current.feedback).toEqual({
      tone: "error",
      title: "Não foi possível enviar o diagnóstico",
      description: "serviço indisponível",
      retryAction: "submit",
    });

    await act(async () => {
      await result.current.handleRetryFeedback();
    });

    expect(mocks.submitRespondentCycle).toHaveBeenCalledTimes(2);
    expect(mocks.fetchWorkbenchData).toHaveBeenCalledTimes(1);
    expect(mocks.routerReplace).toHaveBeenCalledWith(
      "/respondente/ciclos/cycle-1/enviado?returnTo=%2Frespondente%2Fformularios",
    );
  });

});
