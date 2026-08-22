import { describe, expect, it } from "vitest";
import {
  ADMIN_CYCLE_STATE_LABEL,
  RESPONDENT_CYCLE_STATE_LABEL,
  respondentCycleStateLabelOrFallback,
} from "./cycle-labels";

describe("vocabulário de estado por perfil", () => {
  it("explicita quem deve agir para o administrador", () => {
    expect(ADMIN_CYCLE_STATE_LABEL.awaiting_adjustment).toBe(
      "Aguardando correção do respondente",
    );
  });

  it("apresenta ação necessária ao respondente", () => {
    expect(RESPONDENT_CYCLE_STATE_LABEL.awaiting_adjustment).toBe(
      "Correções solicitadas",
    );
    expect(respondentCycleStateLabelOrFallback("awaiting_adjustment")).toBe(
      "Correções solicitadas",
    );
  });
});
