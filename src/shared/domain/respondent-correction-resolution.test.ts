import { describe, expect, it } from "vitest";
import { summarizeRespondentCorrectionResolution } from "./respondent-correction-resolution";

describe("summarizeRespondentCorrectionResolution", () => {
  it("preserva só o ajuste documental quando não há comprovação solicitada", () => {
    const result = summarizeRespondentCorrectionResolution({
      evidences: [
        {
          id: "r1",
          validationStatus: "adjustment_requested",
          submittedAt: "2026-01-01T08:00:00Z",
          validatedAt: "2026-01-02T08:00:00Z",
        },
      ],
      proofRequested: false,
      hasPendingEvidence: false,
    });

    expect(result).toEqual({
      requestedCount: 1,
      resolvedCount: 0,
      unresolvedCount: 1,
      hasAdjustmentRequest: true,
      hasResolvedAllAdjustments: false,
    });
  });

  it("conta comprovação ausente sem documento prévio", () => {
    const result = summarizeRespondentCorrectionResolution({
      evidences: [],
      proofRequested: true,
      hasPendingEvidence: false,
    });

    expect(result.requestedCount).toBe(1);
    expect(result.unresolvedCount).toBe(1);
    expect(result.hasAdjustmentRequest).toBe(true);
    expect(result.hasResolvedAllAdjustments).toBe(false);
  });

  it("resolve comprovação ausente quando há evidência pendente nova", () => {
    const result = summarizeRespondentCorrectionResolution({
      evidences: [
        {
          id: "p1",
          validationStatus: "pending",
          submittedAt: "2026-01-03T08:00:00Z",
        },
      ],
      proofRequested: true,
      hasPendingEvidence: true,
    });

    expect(result.requestedCount).toBe(1);
    expect(result.resolvedCount).toBe(1);
    expect(result.unresolvedCount).toBe(0);
    expect(result.hasResolvedAllAdjustments).toBe(true);
  });

  it("soma ajuste documental e comprovação ausente", () => {
    const result = summarizeRespondentCorrectionResolution({
      evidences: [
        {
          id: "r1",
          validationStatus: "adjustment_requested",
          submittedAt: "2026-01-01T08:00:00Z",
          validatedAt: "2026-01-02T08:00:00Z",
        },
      ],
      proofRequested: true,
      hasPendingEvidence: false,
    });

    expect(result.requestedCount).toBe(2);
    expect(result.unresolvedCount).toBe(2);
  });
});
