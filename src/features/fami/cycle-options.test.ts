import { describe, expect, it } from "vitest";
import type { CycleListItem } from "@/features/cycles/server";
import { buildFamiCycleOptions } from "./cycle-options";

function cycle(overrides: Partial<CycleListItem> = {}): CycleListItem {
  return {
    id: "cycle-1",
    state: "in_response",
    periodId: "period-1",
    periodLabel: "2026",
    organizationId: "org-1",
    organizationName: "Órgão",
    organizationAcronym: "ORG",
    formId: "form-1",
    formName: "Diagnóstico",
    formVersionId: "form-version-1",
    formVersion: 2,
    reopenCount: 1,
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
    workingProcessingId: "processing-working",
    workingProcessingVersion: 2,
    ...overrides,
  };
}

describe("buildFamiCycleOptions", () => {
  it("mantém ciclo reaberto quando existe processamento FAMI concluído", () => {
    const result = buildFamiCycleOptions(
      [cycle()],
      [{
        id: "processing-completed",
        cycleId: "cycle-1",
        processingVersion: 1,
        completedAt: "2026-07-10T12:00:00.000Z",
      }],
      new Set(["processing-completed"]),
    );

    expect(result).toEqual([expect.objectContaining({
      id: "cycle-1",
      closedAt: "2026-07-10T12:00:00.000Z",
    })]);
  });

  it("não lista processamento concluído sem resultado global", () => {
    const result = buildFamiCycleOptions(
      [cycle()],
      [{
        id: "processing-without-global",
        cycleId: "cycle-1",
        processingVersion: 1,
        completedAt: null,
      }],
      new Set(),
    );

    expect(result).toEqual([]);
  });

  it("usa o processamento oficial mais recente", () => {
    const result = buildFamiCycleOptions(
      [cycle({ closedAt: "2025-01-01T00:00:00.000Z" })],
      [
        {
          id: "processing-1",
          cycleId: "cycle-1",
          processingVersion: 1,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "processing-2",
          cycleId: "cycle-1",
          processingVersion: 2,
          completedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      new Set(["processing-1", "processing-2"]),
    );

    expect(result[0]?.closedAt).toBe("2026-06-01T00:00:00.000Z");
  });
});
