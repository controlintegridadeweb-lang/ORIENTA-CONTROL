import { describe, expect, it } from "vitest";
import {
  respondentEvidenceDetailLabel,
  respondentEvidenceNavigation,
  respondentStatusNeedsAction,
} from "./respondent-evidence-helpers";

describe("jornada de evidências do respondente", () => {
  it("só marca como pendência estados que permitem uma ação da organização", () => {
    expect(respondentStatusNeedsAction("pending")).toBe(true);
    expect(respondentStatusNeedsAction("adjustment_requested")).toBe(true);
    expect(respondentStatusNeedsAction("submitted")).toBe(false);
    expect(respondentStatusNeedsAction("invalidated")).toBe(false);
  });

  it("oferece apenas navegações compatíveis com o estado do diagnóstico", () => {
    expect(respondentEvidenceNavigation("pending")).toBe("edit");
    expect(respondentEvidenceNavigation("submitted")).toBe("follow_up");
    expect(respondentEvidenceNavigation("adjustment_requested")).toBe("correct");
    expect(respondentEvidenceNavigation("invalidated")).toBeNull();
    expect(respondentEvidenceNavigation("approved")).toBeNull();
  });

  it("direciona evidência não aprovada para a justificativa, sem prometer reenvio", () => {
    expect(respondentEvidenceDetailLabel("invalidated")).toBe("Ver justificativa");
    expect(respondentEvidenceDetailLabel("submitted")).toBe("Ver detalhes");
  });
});
