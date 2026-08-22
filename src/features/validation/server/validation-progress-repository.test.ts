import { describe, expect, it, vi } from "vitest";
import { loadValidationQueueProgress } from "./validation-progress-repository";

const CYCLE_ID = "00000000-0000-4000-8000-000000000001";

describe("loadValidationQueueProgress", () => {
  it("usa a prontidão transacional mesmo quando a fila não possui pendências visíveis", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        evidence: {
          total: 0,
          pending: 0,
          approved: 0,
          invalid: 0,
          adjustmentRequested: 0,
          notPresented: 0,
          validatedWithoutProof: 0,
          proofRequested: 0,
        },
        notApplicable: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        },
        finalization: {
          ready: false,
          blockers: {
            pendingEvidence: 0,
            pendingNotApplicable: 0,
            undecidedAbsentProof: 0,
            incompleteResponses: 0,
            missingRecommendations: 1,
            missingWorkingProcessing: false,
          },
        },
      },
      error: null,
    });

    const progress = await loadValidationQueueProgress(
      { rpc } as never,
      CYCLE_ID,
    );

    expect(progress.pending).toBe(0);
    expect(progress.readyToConsolidate).toBe(false);
  });
});
