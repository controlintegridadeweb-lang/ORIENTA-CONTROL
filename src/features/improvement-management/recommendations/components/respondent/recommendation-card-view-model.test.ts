import { describe, expect, it } from "vitest";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import {
  RECOMMENDATION_CARD_LABELS,
  RECOMMENDATION_PRIMARY_ACTION_LABELS,
  resolveOperationalSituation,
  resolveRecommendationPrimaryAction,
  toRecommendationCardViewModel,
} from "./recommendation-card-view-model";

function item(over: Partial<RespondentRecommendationItem> = {}): RespondentRecommendationItem {
  return {
    recommendationId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    cycleId: "33333333-3333-4333-8333-333333333333",
    cycleState: "validated",
    canCreateActionPlan: true,
    periodLabel: "2026",
    formId: "form-1",
    formName: "Diagnóstico de Integridade",
    formVersion: 1,
    organizationId: "org-1",
    organizationName: "Órgão Demo",
    axisId: "axis-1",
    axisName: "Governança",
    sectionId: "44444444-4444-4444-8444-444444444444",
    sectionName: "Gestão da Transparência",
    sectionOrder: 1,
    questionOrder: 1,
    questionPrompt:
      "Os responsáveis pela transparência e acesso à informação possuem capacitação compatível com as atribuições exercidas?",
    recommendationText:
      "Promover a capacitação dos servidores responsáveis pela transparência e acesso à informação, especialmente em temas relacionados à Lei de Acesso à Informação, transparência pública e gestão da informação.",
    recommendationType: "nao_implementacao",
    status: "generated",
    planStatus: null,
    hasPlan: false,
    progress: 0,
    needsAction: true,
    actionCount: 0,
    slaLabel: "na",
    createdAt: null,
    updatedAt: null,
    plan: null,
    plans: [],
    ...over,
  };
}

const RETURN = "/respondente/recomendacoes";

describe("resolveOperationalSituation", () => {
  it("usa aguardando cadastro quando não há ações", () => {
    expect(resolveOperationalSituation(item())).toBe("Aguardando cadastro de ações");
  });

  it("não mistura sem ações com em andamento", () => {
    const summary = resolveOperationalSituation(item());
    expect(summary).not.toMatch(/em andamento/i);
    expect(summary).not.toBe("Sem ações cadastradas");
  });

  it("descreve elaboração quando há plano em andamento", () => {
    expect(
      resolveOperationalSituation(
        item({
          status: "in_action_plan",
          hasPlan: true,
          actionCount: 2,
        }),
      ),
    ).toBe("2 ações vinculadas · em elaboração");
  });

  it("marca recomendação concluída sem CTA de cadastro", () => {
    expect(
      resolveOperationalSituation(item({ status: "completed", hasPlan: true, actionCount: 1 })),
    ).toBe("Recomendação concluída");
  });

  it("rotula solicitação de ajuste na situação operacional", () => {
    expect(
      resolveOperationalSituation(
        item({
          status: "adjustment_requested",
          hasPlan: true,
          actionCount: 2,
        }),
      ),
    ).toBe("2 ações vinculadas · Solicitação de ajuste");
  });
});

describe("resolveRecommendationPrimaryAction", () => {
  it("oferece Cadastrar ações sem plano", () => {
    const cta = resolveRecommendationPrimaryAction(item(), RETURN);
    expect(cta?.label).toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.registerActions);
    expect(cta?.variant).toBe("primary");
    expect(cta?.href).toContain(
      "/respondente/plano-acao/11111111-1111-4111-8111-111111111111",
    );
  });

  it("muda o CTA quando já existem ações", () => {
    const cta = resolveRecommendationPrimaryAction(
      item({
        status: "in_action_plan",
        hasPlan: true,
        actionCount: 1,
      }),
      RETURN,
    );
    expect(cta?.label).toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.continuePlan);
    expect(cta?.label).not.toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.registerActions);
    expect(cta?.href).toContain(
      "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/visao-geral",
    );
  });

  it("abre o workspace da recomendação ao visualizar ações", () => {
    const cta = resolveRecommendationPrimaryAction(
      item({
        status: "completed",
        hasPlan: true,
        actionCount: 2,
      }),
      RETURN,
    );
    expect(cta?.label).toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.viewActions);
    expect(cta?.href).toContain(
      "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/visao-geral",
    );
  });

  it("não oferece cadastrar ações para recomendação dispensada", () => {
    const cta = resolveRecommendationPrimaryAction(item({ status: "dismissed" }), RETURN);
    expect(cta?.label).toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.consultRecommendation);
    expect(cta?.label).not.toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.registerActions);
  });
});

describe("toRecommendationCardViewModel", () => {
  it("monta contexto → pergunta → recomendação → acompanhamento", () => {
    const vm = toRecommendationCardViewModel(item(), RETURN, {
      recommendationDisplayCode: "1.1",
    });
    expect(vm.formLabel).toBe("Diagnóstico de Integridade 2026");
    expect(vm.formVersionLabel).toBe("Versão 1");
    expect(vm.originQuestion).toContain("capacitação compatível");
    expect(vm.recommendationDisplayCode).toBe("1.1");
    expect(vm.recommendationText).toContain("Promover a capacitação");
    expect(vm.actionSummary).toBe("Aguardando cadastro de ações");
    expect(vm.primaryAction?.label).toBe(RECOMMENDATION_PRIMARY_ACTION_LABELS.registerActions);
  });

  it("não duplica o nome do formulário quando periodLabel já o contém", () => {
    const vm = toRecommendationCardViewModel(
      item({
        formName: "Diagnóstico de Integridade 2026",
        periodLabel: "Diagnóstico de Integridade 2026",
      }),
      RETURN,
    );
    expect(vm.formLabel).toBe("Diagnóstico de Integridade 2026");
  });

  it("não acrescenta o período se ele já estiver no nome do formulário", () => {
    const vm = toRecommendationCardViewModel(
      item({
        formName: "Diagnóstico de Integridade 2026",
        periodLabel: "2026",
      }),
      RETURN,
    );
    expect(vm.formLabel).toBe("Diagnóstico de Integridade 2026");
  });

  it("não duplica o ano quando o período é variação do mesmo ano", () => {
    const vm = toRecommendationCardViewModel(
      item({
        formName: "Diagnóstico de Integridade 2026",
        periodLabel: "2026.1",
      }),
      RETURN,
    );
    expect(vm.formLabel).toBe("Diagnóstico de Integridade 2026.1");
    expect(vm.formLabel).not.toContain("2026 2026");
  });

  it("não cria título truncado a partir da recomendação", () => {
    const long =
      "Promover a capacitação dos servidores responsáveis pela transparência e acesso à informação, especialmente em temas relacionados à Lei de Acesso à Informação, transparência pública e gestão da informação com muitos detalhes adicionais para não truncar.";
    const vm = toRecommendationCardViewModel(item({ recommendationText: long }), RETURN);
    expect(vm.formLabel).not.toContain("…");
    expect(vm.recommendationText).toBe(long);
    expect(vm.recommendationText).not.toContain("…");
  });

  it("omite detalhes secundários quando não há conteúdo adicional", () => {
    const vm = toRecommendationCardViewModel(item(), RETURN);
    expect(vm.secondaryDetails).toBeUndefined();
  });

  it("expõe observações como conteúdo secundário", () => {
    const vm = toRecommendationCardViewModel(
      item({
        status: "in_action_plan",
        hasPlan: true,
        actionCount: 1,
        plan: {
          id: "plan-1",
          actionText: "ação",
          startDate: "2099-01-01",
          dueDate: "2099-01-01",
          responsibleSector: "TI",
          responsibleUserId: "55555555-5555-4555-8555-555555555555",
          responsibleName: "Alice",
          progressPercentage: 10,
          status: "in_progress",
          observations: "Observação administrativa",
          updatedAt: "2025-06-10T10:00:00Z",
          revision: 1,
          documents: [],
          slaLabel: "ok",
        },
      }),
      RETURN,
    );
    expect(vm.secondaryDetails?.observations).toBe("Observação administrativa");
  });

  it("usa o rótulo Pergunta de origem no card de recomendações", () => {
    expect(RECOMMENDATION_CARD_LABELS.originQuestion).toBe("Pergunta de origem");
  });
});
