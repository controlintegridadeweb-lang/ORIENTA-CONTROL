// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedFormCriterion } from "../contracts";
import { ReadonlyCriterionCard } from "./ReadonlyCriterionCard";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
}));

vi.mock("@/infrastructure/notifications/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/notifications/notify")>();
  return {
    ...actual,
    notify: {
      ...actual.notify,
      success: mocks.success,
    },
  };
});

function makeCriterion(
  over: Partial<UnifiedFormCriterion> = {},
): UnifiedFormCriterion {
  return {
    responseId: "response-40",
    questionPrompt: "O órgão promove orientação ética?",
    sectionId: "section-1",
    sectionName: "Gestão da Ética",
    sectionOrder: 0,
    axisId: "axis-1",
    axisName: "Governança",
    orderIndex: 39,
    answer: "no",
    requiresEvidence: true,
    allowsNotApplicable: true,
    famiEnabled: true,
    respondentNote: "Resposta original parcial.",
    naJustification: null,
    answeredByName: "Respondente",
    answeredAt: "2026-07-28T15:30:00.000Z",
    evidenceCount: 0,
    evidenceStatus: null,
    validationNeed: "no_validation",
    visualStatus: "negative",
    visualStatusLabel: "Resposta negativa",
    awaitsAdminAction: false,
    obtainedPoints: 0,
    possiblePoints: 2,
    includedInCalculation: true,
    recommendationText: "Instituição de rotina de orientação ética.",
    documents: [],
    evidenceGroup: null,
    notApplicableItem: null,
    readonlyView: true,
    ...over,
  };
}

afterEach(() => cleanup());

describe("ReadonlyCriterionCard", () => {
  beforeEach(() => {
    mocks.success.mockReset();
  });

  it("para “Não” sem decisão prévia, não exige veredito administrativo", () => {
    render(
      <ReadonlyCriterionCard
        criterion={makeCriterion()}
        onMarkAdminNotApplicable={vi.fn()}
        onAbsentProofDecision={vi.fn()}
      />,
    );

    expect(screen.getByText("Resposta negativa")).toBeTruthy();
    expect(screen.queryByText("Validação")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Aprovar evidência" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Considerar insuficiente" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Solicitar ajuste" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeTruthy();
  });

  it("ao alterar decisão prévia, confirma insuficiente via RPC de ausência de prova", async () => {
    const onAbsentProofDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <ReadonlyCriterionCard
        criterion={makeCriterion({
          evidenceStatus: "considered_insufficient",
          validationNeed: "analyzed",
          visualStatus: "analysis_complete",
          visualStatusLabel: "Análise concluída",
          awaitsAdminAction: false,
        })}
        onMarkAdminNotApplicable={vi.fn()}
        onAbsentProofDecision={onAbsentProofDecision}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Alterar decisão" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Considerar insuficiente" }),
    );
    const confirm = screen.getByRole("button", {
      name: "Confirmar: Considerar insuficiente",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Implementação parcial sem formalização suficiente." },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(onAbsentProofDecision).toHaveBeenCalledWith(
        "response-40",
        "consider_insufficient",
        "Implementação parcial sem formalização suficiente.",
      ),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "Critério marcado como insuficiente.",
    );
  });

  it("não oferece ações quando o critério não é elegível", () => {
    render(
      <ReadonlyCriterionCard
        criterion={makeCriterion({ allowsNotApplicable: false })}
        onMarkAdminNotApplicable={vi.fn()}
        onAbsentProofDecision={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Aprovar evidência" }),
    ).toBeNull();
    expect(
      screen.getByText(
        /Consulta do formulário — este critério não exige decisão administrativa/,
      ),
    ).toBeTruthy();
  });
});
