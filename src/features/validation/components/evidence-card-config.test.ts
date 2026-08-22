import { describe, expect, it } from "vitest";
import {
  ABSENT_ACTION_LABEL,
  administrativeDecisionButtonClass,
  EVIDENCE_ACTION_LABEL,
  evidenceDecisionButtonClass,
  friendlyEvidenceLinkLabel,
} from "./evidence-card-config";

describe("evidence-card-config", () => {
  it("mantém rótulos distintos entre decisão da evidência e do critério", () => {
    expect(EVIDENCE_ACTION_LABEL.approve).toBe("Aprovar evidência");
    expect(ABSENT_ACTION_LABEL.validate_without_proof).toBe(
      "Validar sem comprovação",
    );
    expect(ABSENT_ACTION_LABEL.consider_insufficient).toBe(
      "Considerar o critério insuficiente",
    );
    expect(ABSENT_ACTION_LABEL.request_proof).toBe("Solicitar comprovação");
  });

  it("gera rótulo amigável para links externos sem expor a URL", () => {
    expect(
      friendlyEvidenceLinkLabel(
        "https://drive.google.com/file/d/abc123/view?usp=sharing",
      ),
    ).toBe("Google Drive");
    expect(
      friendlyEvidenceLinkLabel("https://www.dropbox.com/s/xyz/file.pdf"),
    ).toBe("Dropbox");
    expect(friendlyEvidenceLinkLabel("https://github.com/org/repo")).toBe(
      "GitHub",
    );
    expect(friendlyEvidenceLinkLabel("https://example.org/path")).toBe(
      "example.org",
    );
    expect(friendlyEvidenceLinkLabel(null)).toBe("Link externo");
  });

  it("aplica peso visual maior à aprovação da evidência", () => {
    const approve = evidenceDecisionButtonClass("approve", false);
    const invalidate = evidenceDecisionButtonClass("invalidate", false);
    expect(approve).toContain("w-full");
    expect(invalidate).toContain("w-full");
    expect(approve).not.toEqual(invalidate);
  });

  it("reutiliza o mesmo peso visual nas decisões administrativas", () => {
    expect(administrativeDecisionButtonClass("validate_without_proof", false)).toBe(
      evidenceDecisionButtonClass("approve", false),
    );
    expect(
      administrativeDecisionButtonClass("consider_insufficient", false),
    ).toBe(evidenceDecisionButtonClass("invalidate", false));
  });
});
