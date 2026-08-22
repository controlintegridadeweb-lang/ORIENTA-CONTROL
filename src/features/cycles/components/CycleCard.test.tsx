// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { CycleCard } from "./CycleCard";

function cycle(over: Partial<CycleListItem> = {}): CycleListItem {
  return {
    id: "cycle-1",
    state: "in_response",
    periodId: "period-1",
    periodLabel: "2026",
    organizationId: "org-1",
    organizationName: "Organização Teste",
    organizationAcronym: "ORG",
    formId: "form-1",
    formName: "Diagnóstico",
    formVersionId: "version-1",
    formVersion: 1,
    reopenCount: 0,
    startsAt: "2026-01-01T12:00:00.000Z",
    responseDeadlineAt: "2026-08-31T23:59:00.000Z",
    originalResponseDeadlineAt: "2026-08-31T23:59:00.000Z",
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

describe("CycleCard — indicadores de gestão", () => {
  afterEach(() => {
    cleanup();
  });

  it("mostra Suspenso quando a coleta está pausada", () => {
    render(
      <CycleCard
        cycle={cycle({
          responseCollectionPausedAt: "2026-08-01T10:00:00.000Z",
        })}
      />,
    );

    expect(screen.getByText("Suspenso")).toBeTruthy();
    expect(screen.queryByText(/Prazo vencido/)).toBeNull();
  });

  it("mostra Prazo excepcional quando o prazo difere do original", () => {
    render(
      <CycleCard
        cycle={cycle({
          responseDeadlineAt: "2026-09-15T23:59:00.000Z",
          originalResponseDeadlineAt: "2026-08-31T23:59:00.000Z",
          deadlineChangeCount: 1,
        })}
      />,
    );

    expect(screen.getByText("Prazo excepcional")).toBeTruthy();
  });

  it("não marca Prazo excepcional quando prazo = original", () => {
    render(<CycleCard cycle={cycle()} />);

    expect(screen.queryByText("Prazo excepcional")).toBeNull();
    expect(screen.queryByText("Suspenso")).toBeNull();
  });

  it("suprime Prazo vencido enquanto suspenso, mesmo com overdue=true", () => {
    render(
      <CycleCard
        cycle={cycle({
          responseCollectionPausedAt: "2026-08-01T10:00:00.000Z",
          responseDeadlineAt: "2026-07-01T12:00:00.000Z",
          originalResponseDeadlineAt: "2026-07-01T12:00:00.000Z",
        })}
        overdue
      />,
    );

    expect(screen.getByText("Suspenso")).toBeTruthy();
    expect(screen.queryByText(/Prazo vencido/)).toBeNull();
  });
});
