import { describe, expect, it } from "vitest";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import { toAdminRecommendationCardViewModel } from "./admin-recommendation-card-view-model";

function item(over: Partial<AdminRecommendationItem> = {}): AdminRecommendationItem {
  return {
    recommendationId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    plans: [],
    planId: null,
    organizationId: "org-1",
    organizationName: "Corpo de Bombeiros Militar do Rio Grande do Norte",
    formId: "form-1",
    cycleId: "cycle-1",
    cycleState: "validated",
    canCreateActionPlan: true,
    periodLabel: "2026",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    axisId: "axis-1",
    axisName: "Governanca",
    sectionId: "section-1",
    sectionName: "Gestão da Ética",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt:
      "São adotadas ações específicas para prevenção de conflitos de interesse?",
    recommendationText:
      "Adotar medidas institucionais voltadas à prevenção de conflitos de interesse.",
    recommendationType: "nao_implementacao",
    recommendationStatus: "generated",
    planStatus: null,
    hasPlan: false,
    isOverdue: false,
    isDueSoon: false,
    progress: 0,
    startDate: null,
    dueDate: null,
    responsibleName: null,
    responsibleSector: null,
    updatedAt: null,
    recommendationCreatedAt: null,
    ...over,
  };
}

describe("toAdminRecommendationCardViewModel", () => {
  it("separa formulário, órgão e pergunta sem concatenar", () => {
    const vm = toAdminRecommendationCardViewModel(item(), "1.1", {
      returnTo: "/admin/recomendacoes",
      showOrganization: true,
    });

    expect(vm.formLabel).toBe("Diagnóstico de Integridade 2026");
    expect(vm.formVersionLabel).toBe("Versão 1");
    expect(vm.organizationName).toBe(
      "Corpo de Bombeiros Militar do Rio Grande do Norte",
    );
    expect(vm.originQuestion).toContain("conflitos de interesse");
    expect(vm.recommendationText).toContain("Adotar medidas institucionais");
    expect(vm.recommendationDisplayCode).toBe("1.1");
    expect(vm.situationLabel).toBe("Gerada");
    expect(vm.actionCountLabel).toBe("Sem ações vinculadas");
    expect(vm.actionPlanHref).toContain(
      "/admin/plano-acao/11111111-1111-4111-8111-111111111111/visao-geral",
    );
  });

  it("rotula solicitação de ajuste na situação do plano", () => {
    const vm = toAdminRecommendationCardViewModel(
      item({ recommendationStatus: "adjustment_requested", hasPlan: true }),
      "1.1",
      { returnTo: "/admin/recomendacoes", showOrganization: false },
    );
    expect(vm.situationLabel).toBe("Solicitação de ajuste");
  });

  it("omite o órgão quando hideOrganization", () => {
    const vm = toAdminRecommendationCardViewModel(item(), "2.1", {
      returnTo: "/admin/recomendacoes",
      showOrganization: false,
    });
    expect(vm.organizationName).toBeNull();
  });
});
