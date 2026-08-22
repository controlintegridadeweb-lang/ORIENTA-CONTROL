import { describe, expect, it } from "vitest";
import type { QuestionWaiverRow } from "@/features/forms/waiver-client";
import {
  buildDesiredQuestionWaivers,
  deriveWaiverReasonState,
  waiverReplacementChanged,
} from "./question-waiver-editor-model";

function waiver(
  organizationId: string,
  reason: string | null,
): QuestionWaiverRow {
  return {
    organizationId,
    questionId: "question-1",
    reason,
    waivedBy: "user-1",
    waivedAt: "2026-07-10T00:00:00.000Z",
  };
}

describe("question waiver editor model", () => {
  it("preserva justificativas diferentes quando o campo não foi editado", () => {
    const current = new Map([
      ["org-a", waiver("org-a", "Motivo A")],
      ["org-b", waiver("org-b", "Motivo B")],
    ]);

    expect(deriveWaiverReasonState(current)).toEqual({
      displayedReason: "",
      hasMixedReasons: true,
    });

    const desired = buildDesiredQuestionWaivers({
      current,
      selectedOrganizationIds: new Set(["org-a", "org-b"]),
      displayedReason: "",
      reasonTouched: false,
    });

    expect(desired).toEqual([
      { organizationId: "org-a", reason: "Motivo A" },
      { organizationId: "org-b", reason: "Motivo B" },
    ]);
    expect(waiverReplacementChanged(current, desired)).toBe(false);
  });

  it("aplica a nova justificativa a todas quando o campo foi editado", () => {
    const current = new Map([
      ["org-a", waiver("org-a", "Motivo A")],
      ["org-b", waiver("org-b", "Motivo B")],
    ]);

    const desired = buildDesiredQuestionWaivers({
      current,
      selectedOrganizationIds: new Set(["org-a", "org-b", "org-c"]),
      displayedReason: "  Motivo consolidado  ",
      reasonTouched: true,
    });

    expect(desired).toEqual([
      { organizationId: "org-a", reason: "Motivo consolidado" },
      { organizationId: "org-b", reason: "Motivo consolidado" },
      { organizationId: "org-c", reason: "Motivo consolidado" },
    ]);
    expect(waiverReplacementChanged(current, desired)).toBe(true);
  });

  it("reutiliza a justificativa comum para uma organização recém-marcada", () => {
    const current = new Map([
      ["org-a", waiver("org-a", "Motivo comum")],
      ["org-b", waiver("org-b", "Motivo comum")],
    ]);

    const desired = buildDesiredQuestionWaivers({
      current,
      selectedOrganizationIds: new Set(["org-a", "org-b", "org-c"]),
      displayedReason: "Motivo comum",
      reasonTouched: false,
    });

    expect(desired).toContainEqual({
      organizationId: "org-c",
      reason: "Motivo comum",
    });
  });
});
