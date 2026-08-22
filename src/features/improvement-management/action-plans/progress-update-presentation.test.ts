import { describe, expect, it } from "vitest";
import type { ActionPlanProgressUpdate } from "./types";
import {
  formatProgressTransition,
  progressUpdateBody,
  progressUpdateHeadline,
  progressUpdateHistoryText,
} from "./progress-update-presentation";

function update(
  over: Partial<ActionPlanProgressUpdate> = {},
): ActionPlanProgressUpdate {
  return {
    id: "u-1",
    previousPercentage: 0,
    newPercentage: 15,
    previousStatus: "not_started",
    newStatus: "in_progress",
    description: "Capacitação iniciada com a equipe.",
    createdAt: "2026-08-13T12:00:00Z",
    createdByName: "Alice",
    ...over,
  };
}

describe("progress-update-presentation", () => {
  it("formata a transição de progresso", () => {
    expect(formatProgressTransition(0, 15)).toBe("0% → 15%");
  });

  it("usa a descrição informada na atualização", () => {
    expect(progressUpdateBody(update())).toBe("Capacitação iniciada com a equipe.");
  });

  it("identifica o cadastro inicial sem descrição", () => {
    expect(
      progressUpdateBody(
        update({
          previousPercentage: 0,
          newPercentage: 0,
          previousStatus: "not_started",
          newStatus: "not_started",
          description: "  ",
        }),
      ),
    ).toBe("Ação cadastrada.");
  });

  it("compõe título com progresso e situação quando ambos mudam", () => {
    expect(progressUpdateHeadline(update())).toBe(
      "0% → 15% · Não iniciado → Em andamento",
    );
  });

  it("mostra só o progresso quando a situação permanece", () => {
    expect(
      progressUpdateHeadline(
        update({
          previousPercentage: 15,
          newPercentage: 40,
          previousStatus: "in_progress",
          newStatus: "in_progress",
        }),
      ),
    ).toBe("15% → 40%");
  });

  it("descreve a movimentação do histórico sem inventar texto", () => {
    expect(progressUpdateHistoryText(update())).toBe(
      "Capacitação iniciada com a equipe.",
    );
    expect(
      progressUpdateHistoryText(
        update({
          description: null,
          previousPercentage: 20,
          newPercentage: 45,
        }),
      ),
    ).toBe("Progresso atualizado para 45%");
    expect(
      progressUpdateHistoryText(
        update({
          description: "  ",
          previousPercentage: 0,
          newPercentage: 0,
          previousStatus: "not_started",
        }),
      ),
    ).toBe("Ação cadastrada.");
  });
});
