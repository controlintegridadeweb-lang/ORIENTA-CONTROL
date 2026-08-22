import { describe, expect, it } from "vitest";
import { evidenceVerdictToAbsentProofAction } from "./verdict-action-mapping";

describe("evidenceVerdictToAbsentProofAction", () => {
  it("mapeia o trio unificado para a RPC sem documento", () => {
    expect(evidenceVerdictToAbsentProofAction("approve")).toBe(
      "validate_without_proof",
    );
    expect(evidenceVerdictToAbsentProofAction("invalidate")).toBe(
      "consider_insufficient",
    );
    expect(evidenceVerdictToAbsentProofAction("request_adjustment")).toBe(
      "request_proof",
    );
  });
});
