import { describe, expect, it } from "vitest";
import { summarizeEvidenceAdjustmentResolution } from "./evidence-adjustment-matching";

function evidence(
  id: string,
  validationStatus:
    | "pending"
    | "approved"
    | "invalidated"
    | "adjustment_requested",
  submittedAt: string,
  validatedAt: string | null = null,
) {
  return { id, validationStatus, submittedAt, validatedAt };
}

describe("pareamento de correções de evidências", () => {
  it("exige uma nova evidência para cada evidência devolvida", () => {
    const result = summarizeEvidenceAdjustmentResolution([
      evidence(
        "request-1",
        "adjustment_requested",
        "2026-01-01T08:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
      evidence(
        "request-2",
        "adjustment_requested",
        "2026-01-01T09:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
      evidence("replacement-1", "pending", "2026-01-03T08:00:00Z"),
    ]);

    expect(result).toEqual({
      requestedCount: 2,
      resolvedCount: 1,
      unresolvedCount: 1,
      hasAdjustmentRequest: true,
      hasResolvedAllAdjustments: false,
    });
  });

  it("considera todas resolvidas somente com substituições distintas", () => {
    const result = summarizeEvidenceAdjustmentResolution([
      evidence(
        "request-1",
        "adjustment_requested",
        "2026-01-01T08:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
      evidence(
        "request-2",
        "adjustment_requested",
        "2026-01-01T09:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
      evidence("replacement-1", "pending", "2026-01-03T08:00:00Z"),
      evidence("replacement-2", "pending", "2026-01-03T09:00:00Z"),
    ]);

    expect(result.resolvedCount).toBe(2);
    expect(result.unresolvedCount).toBe(0);
    expect(result.hasResolvedAllAdjustments).toBe(true);
  });

  it("ignora evidência pendente enviada antes da devolutiva", () => {
    const result = summarizeEvidenceAdjustmentResolution([
      evidence("old-pending", "pending", "2026-01-01T07:00:00Z"),
      evidence(
        "request",
        "adjustment_requested",
        "2026-01-01T08:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
    ]);

    expect(result.resolvedCount).toBe(0);
    expect(result.unresolvedCount).toBe(1);
  });

  it("descarta substituições intermediárias que não atendem devolutivas posteriores", () => {
    const result = summarizeEvidenceAdjustmentResolution([
      evidence(
        "request-1",
        "adjustment_requested",
        "2026-01-01T08:00:00Z",
        "2026-01-02T08:00:00Z",
      ),
      evidence("replacement-1", "pending", "2026-01-02T09:00:00Z"),
      evidence(
        "request-2",
        "adjustment_requested",
        "2026-01-01T09:00:00Z",
        "2026-01-03T08:00:00Z",
      ),
      evidence("replacement-too-early", "pending", "2026-01-02T10:00:00Z"),
      evidence("replacement-2", "pending", "2026-01-04T08:00:00Z"),
    ]);

    expect(result.resolvedCount).toBe(2);
    expect(result.unresolvedCount).toBe(0);
  });

  it("compara instantes equivalentes sem depender do formato do fuso", () => {
    const result = summarizeEvidenceAdjustmentResolution([
      evidence(
        "request",
        "adjustment_requested",
        "2026-07-20T09:00:00-03:00",
        "2026-07-20T10:00:00-03:00",
      ),
      evidence("replacement", "pending", "2026-07-20T13:30:00Z"),
    ]);

    expect(result.resolvedCount).toBe(1);
    expect(result.unresolvedCount).toBe(0);
  });
});
