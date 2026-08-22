// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { transitionAdminCycle } from "@/features/cycles/client";
import { CycleCloseActions } from "./cycle-close-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/shared/ui/components/confirm-dialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock("@/features/cycles/client", () => ({
  transitionAdminCycle: vi.fn(),
}));

function cycle(): CycleListItem {
  return {
    id: "cycle-1",
    state: "validated",
    periodId: "period-1",
    periodLabel: "2026",
    organizationId: "org-1",
    organizationName: "Organização",
    organizationAcronym: "ORG",
    formId: "form-1",
    formName: "Diagnóstico",
    formVersionId: "version-1",
    formVersion: 1,
    reopenCount: 0,
    startsAt: null,
    responseDeadlineAt: null,
    originalResponseDeadlineAt: null,
    validationDeadlineAt: null,
    cycleCloseAt: null,
    submittedLateAt: null,
    submissionDelaySeconds: null,
    closedAt: null,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    responseCollectionPausedAt: null,
    deadlineChangeCount: 0,
    workingProcessingId: "processing-1",
    workingProcessingVersion: 1,
  };
}

describe("CycleCloseActions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("mostra pendências de forma discreta e bloqueia o encerramento", () => {
    render(
      <CycleCloseActions
        cycle={cycle()}
        completionReadiness={{
          ready: false,
          pendingCount: 1,
          blocks: [],
          countsByReason: {
            exception_pending: 0,
            missing_active_action: 64,
            action_not_completed: 0,
            open_supervision_request: 0,
            missing_execution_evidence: 0,
            action_not_approved: 0,
          },
        }}
      />,
    );

    expect(screen.getByText("Encerramento da avaliação")).toBeTruthy();
    expect(screen.getByText(/64 recomendação\(ões\) sem ação ativa/)).toBeTruthy();
    expect(screen.queryByText(/A supervisão ainda possui pendências/)).toBeNull();
    const closeButton = screen.getByRole("button", {
      name: "Encerrar avaliação",
    }) as HTMLButtonElement;
    expect(closeButton.disabled).toBe(true);
    expect(
      screen.getByRole("link", { name: /abrir plano de ação/i }).getAttribute("href"),
    ).toBe("/admin/plano-acao?organizationId=org-1&formId=form-1&cycleId=cycle-1");
  });

  it("encerra a avaliação quando o plano está apto", async () => {
    render(
      <CycleCloseActions
        cycle={cycle()}
        completionReadiness={{
          ready: true,
          pendingCount: 0,
          blocks: [],
          countsByReason: {
            exception_pending: 0,
            missing_active_action: 0,
            action_not_completed: 0,
            open_supervision_request: 0,
            missing_execution_evidence: 0,
            action_not_approved: 0,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Encerrar avaliação" }));

    await waitFor(() => {
      expect(vi.mocked(transitionAdminCycle)).toHaveBeenCalledWith(
        "cycle-1",
        "completed",
      );
    });
  });
});
