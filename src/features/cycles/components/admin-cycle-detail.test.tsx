// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { AdminCycleDetail } from "./admin-cycle-detail";

vi.mock("./CycleActions", () => ({ CycleActions: () => null }));
vi.mock("./cycle-close-actions", () => ({ CycleCloseActions: () => null }));

function cycle(over: Partial<CycleListItem> = {}): CycleListItem {
  return {
    id: "cycle-1",
    state: "in_response",
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
    startsAt: "2026-01-01T12:00:00.000Z",
    responseDeadlineAt: "2026-02-01T12:00:00.000Z",
    originalResponseDeadlineAt: "2026-02-01T12:00:00.000Z",
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
    ...over,
  };
}

describe("AdminCycleDetail — reaberturas", () => {
  afterEach(() => {
    cleanup();
  });

  it("omite o campo enquanto o diagnóstico nunca foi reaberto", () => {
    render(
      <AdminCycleDetail
        cycle={cycle()}
        completionReadiness={null}
        reportLifecycleStatus={null}
      />,
    );
    expect(screen.queryByText("Reaberturas")).toBeNull();
  });

  it("exibe a quantidade depois da primeira reabertura", () => {
    render(
      <AdminCycleDetail
        cycle={cycle({ reopenCount: 1 })}
        completionReadiness={null}
        reportLifecycleStatus={null}
      />,
    );
    expect(screen.getByText("Reaberturas")).toBeTruthy();
    expect(screen.getByText("1 reabertura")).toBeTruthy();
  });
});
