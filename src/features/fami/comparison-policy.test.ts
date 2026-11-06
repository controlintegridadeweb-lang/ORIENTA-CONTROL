import { describe, expect, it } from "vitest";
import {
  criteriaBaseCompatible,
  exerciseAllowsInterimMonitoring,
  formatPercentagePoints,
  globalPercentagePointDelta,
  isStrictEvolution,
  questionsCorrespond,
  selectOfficialDiagnostic,
  type QuestionMeasure,
} from "./comparison-policy";

function measure(over: Partial<QuestionMeasure> = {}): QuestionMeasure {
  return {
    questionId: "q-1",
    prompt: "A organização publica o plano?",
    evidenceRequired: true,
    famiEnabled: true,
    axisId: "axis-gov",
    ...over,
  };
}

describe("exercício sem acompanhamento intermediário", () => {
  it("impede relatório de monitoramento e FAMI preliminar em 2026", () => {
    expect(exerciseAllowsInterimMonitoring(2026)).toBe(false);
    expect(exerciseAllowsInterimMonitoring(2025)).toBe(true);
    expect(exerciseAllowsInterimMonitoring(2027)).toBe(true);
  });
});

describe("diferença global", () => {
  it("subtrai percentuais congelados e expressa pontos percentuais", () => {
    expect(globalPercentagePointDelta(72, 65)).toBe(7);
    expect(formatPercentagePoints(7)).toBe("+7 pontos percentuais");
    expect(formatPercentagePoints(-2.5)).toBe("-2.5 pontos percentuais");
  });

  it("não transforma ausência em zero", () => {
    expect(globalPercentagePointDelta(72, null)).toBeNull();
    expect(globalPercentagePointDelta(null, 65)).toBeNull();
  });
});

describe("correspondência de perguntas", () => {
  it("aceita o mesmo question_id quando a medida não muda", () => {
    expect(questionsCorrespond(measure(), measure())).toBe(true);
  });

  it("recusa enunciado, evidência, inclusão no FAMI ou eixo diferentes", () => {
    expect(questionsCorrespond(measure(), measure({ prompt: "Outro enunciado" }))).toBe(false);
    expect(questionsCorrespond(measure(), measure({ evidenceRequired: false }))).toBe(false);
    expect(questionsCorrespond(measure(), measure({ famiEnabled: false }))).toBe(false);
    expect(questionsCorrespond(measure(), measure({ axisId: "axis-soc" }))).toBe(false);
  });

  it("trata bases de tamanhos diferentes como incompatíveis", () => {
    const previous = [measure({ questionId: "q-1" })];
    const current = [
      measure({ questionId: "q-1" }),
      measure({ questionId: "q-2", prompt: "Nova pergunta" }),
    ];
    expect(criteriaBaseCompatible(previous, current)).toBe(false);
  });
});

describe("evolução estrita", () => {
  it("exige formulário, órgão, política e base compatível", () => {
    expect(
      isStrictEvolution({
        sameForm: true,
        sameOrganization: true,
        samePolicy: true,
        compatibleBase: true,
      }),
    ).toBe(true);
    expect(
      isStrictEvolution({
        sameForm: true,
        sameOrganization: true,
        samePolicy: true,
        compatibleBase: false,
      }),
    ).toBe(false);
    expect(
      isStrictEvolution({
        sameForm: true,
        sameOrganization: true,
        samePolicy: false,
        compatibleBase: true,
      }),
    ).toBe(false);
  });
});

describe("desempate do diagnóstico de referência", () => {
  it("prefere o completed_at mais recente e, no mesmo instante, o menor cycle_id", () => {
    const selected = selectOfficialDiagnostic([
      { cycleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", completedAt: "2026-07-01T00:00:00.000Z" },
      { cycleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", completedAt: "2026-07-01T00:00:00.000Z" },
      { cycleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", completedAt: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(selected?.cycleId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
