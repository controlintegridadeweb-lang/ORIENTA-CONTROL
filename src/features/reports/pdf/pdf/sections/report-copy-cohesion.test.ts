import { describe, expect, it } from "vitest";
import { FAMI_SCORING_GROUPS } from "@/features/fami";
import { conclusionPriorityActions } from "./conclusion-section";
import { DIAGNOSTIC_SUMMARY_INDICATORS } from "./diagnostic-summary-section";
import { OFFICIAL_REPORT_COVER_FIELD_LABELS } from "./cover-page";
import { hasComparableFamiEvolution } from "./evolution-section";
import { reportPeriodMetadataLines } from "./annexes-section";
import { OFFICIAL_REPORT_SECTION_ORDER } from "../build-official-report";

describe("coesão textual do relatório oficial", () => {
  it("usa indicadores do resumo do diagnóstico", () => {
    expect(DIAGNOSTIC_SUMMARY_INDICATORS).toEqual({
      evaluatedQuestions: "Total de perguntas avaliadas",
      totalRecommendations: "Total de recomendações identificadas",
      evaluatedSections: "Total de seções avaliadas",
      sectionsWithRecommendations: "Seções que tiveram recomendações",
    });
  });

  it("mantém a capa executiva com campos institucionais", () => {
    expect(OFFICIAL_REPORT_COVER_FIELD_LABELS).toEqual([
      "Período de referência",
      "Formulário",
      "Resultado FAMI",
      "Organização",
      "Data de emissão",
    ]);
  });

  it("segue a ordem estrutural do novo modelo", () => {
    expect(OFFICIAL_REPORT_SECTION_ORDER).toEqual([
      "fami_summary",
      "detailed_analysis",
      "diagnostic_summary",
      "detailed_axis_analysis",
      "conclusion",
      "metadata_audit",
    ]);
  });

  it("não duplica período quando período informado e referência são iguais", () => {
    expect(
      reportPeriodMetadataLines({
        periodLabel: "2026",
        referencePeriodLabel: "2026",
      }),
    ).toEqual(["Período: 2026"]);

    expect(
      reportPeriodMetadataLines({
        periodLabel: "2026.1",
        referencePeriodLabel: "2026",
      }),
    ).toEqual(["Período: 2026.1", "Período de referência: 2026"]);
  });

  it("só exibe evolução FAMI com pelo menos dois resultados comparáveis", () => {
    expect(hasComparableFamiEvolution([])).toBe(false);
    expect(hasComparableFamiEvolution([{ globalPercentage: 50 }])).toBe(false);
    expect(
      hasComparableFamiEvolution([
        { globalPercentage: null },
        { globalPercentage: 50 },
      ]),
    ).toBe(false);
    expect(
      hasComparableFamiEvolution([
        { globalPercentage: 50 },
        { globalPercentage: null },
        { globalPercentage: 60 },
      ]),
    ).toBe(true);
  });

  it("consolida o encerramento sem criar pendências incompatíveis com um ciclo concluído", () => {
    expect(conclusionPriorityActions({
      criticalAxesCount: 0,
    })).toEqual([
      "Preservar as comprovações e os registros de supervisão que sustentam o encerramento desta avaliação.",
      "Acompanhar a sustentabilidade dos resultados alcançados e incorporar novas necessidades ao próximo ciclo de avaliação.",
    ]);

    const actions = conclusionPriorityActions({
      criticalAxesCount: 2,
      topOpportunityAxis: "Social",
    });
    expect(actions).toEqual([
      "Registrar o eixo Social e os demais eixos críticos como prioridades do próximo ciclo de avaliação.",
      "Preservar as comprovações e os registros de supervisão que sustentam o encerramento desta avaliação.",
      "Acompanhar a sustentabilidade dos resultados alcançados e incorporar novas necessidades ao próximo ciclo de avaliação.",
    ]);
    expect(actions.join(" ")).not.toContain("Cadastrar ações");
    expect(actions.join(" ")).not.toContain("reprogramar");
    expect(actions.join(" ")).not.toContain("validar evidências");
  });

  it("reflete a regra FAMI vigente: 1,0 sem exigência; 0 sem aprovação em evidência", () => {
    const basicPoints = FAMI_SCORING_GROUPS.find((group) => group.id === "yes");
    const zeroPoints = FAMI_SCORING_GROUPS.find((group) => group.id === "zero");

    expect(basicPoints?.items).toEqual([
      "Resposta Sim em critério que não exige evidência.",
    ]);
    expect(zeroPoints?.items).toEqual([
      "Resposta Não.",
      "Resposta Sim em critério que exige evidência, mas sem comprovação aprovada.",
    ]);
  });
});
