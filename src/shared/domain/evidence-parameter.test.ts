import { describe, expect, it } from "vitest";
import { isEvidenceRequired, parseEvidenceParameter } from "./evidence-parameter";

describe("evidence_parameter", () => {
  it("uses evidence_parameter.required as the only source of truth", () => {
    expect(isEvidenceRequired({ evidence_parameter: { required: true } })).toBe(true);
    expect(isEvidenceRequired({ evidence_parameter: { required: false } })).toBe(false);
    expect(isEvidenceRequired({})).toBe(false);
  });

  it("rejects malformed values", () => {
    expect(parseEvidenceParameter({ required: "true" })).toBeNull();
    expect(parseEvidenceParameter([])).toBeNull();
  });
});
