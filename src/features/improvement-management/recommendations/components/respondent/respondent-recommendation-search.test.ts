import { describe, expect, it } from "vitest";
import {
  keepTypingSearch,
  matchesRecommendationSearch,
} from "./respondent-recommendation-search";

const item = {
  recommendationText: "Publicar a composição da unidade",
  axisName: "Governança",
  sectionName: "Governança e Estrutura de Integridade",
  formName: "Diagnóstico de Integridade 2026",
  questionPrompt: "As informações da UCI estão divulgadas?",
  plans: [
    {
      actionText: "Divulgar canais de contato da UCI no sítio oficial",
      responsibleName: "Unidade de Integridade",
      responsibleSector: "Corregedoria",
    },
  ],
};

describe("busca do plano de integridade e compliance", () => {
  it("encontra a ação, a área responsável e a recomendação", () => {
    expect(matchesRecommendationSearch(item, "canais de contato")).toBe(true);
    expect(matchesRecommendationSearch(item, "corregedoria")).toBe(true);
    expect(matchesRecommendationSearch(item, "composição da unidade")).toBe(true);
  });

  it("ignora texto que não está na recomendação nem na ação", () => {
    expect(matchesRecommendationSearch(item, "resíduos sólidos")).toBe(false);
  });

  it("encontra a ação mesmo sem acento e com as palavras fora de ordem", () => {
    expect(matchesRecommendationSearch(item, "sitio uci")).toBe(true);
    expect(matchesRecommendationSearch(item, "CANAIS oficial")).toBe(true);
    expect(
      matchesRecommendationSearch(
        {
          ...item,
          plans: [{ ...item.plans[0], actionText: "Publicar a ação no portal" }],
        },
        "acao portal",
      ),
    ).toBe(true);
  });

  it("encontra a ação pelo número exibido na seção", () => {
    expect(matchesRecommendationSearch(item, "a1", "ação a1 a1")).toBe(true);
    expect(matchesRecommendationSearch(item, "a9", "ação a1 a1")).toBe(false);
  });
});

describe("busca digitada contra a URL", () => {
  it("mantém o espaço ainda não gravado na URL", () => {
    expect(keepTypingSearch("uci ", "uci", "uci")).toBe("uci ");
  });

  it("não deixa a URL atrasada apagar o que acabou de ser digitado", () => {
    expect(keepTypingSearch("canais", "cana", "cana")).toBe("canais");
  });

  it("aceita uma busca vinda da navegação, como voltar", () => {
    expect(keepTypingSearch("canais", "uci", "canais")).toBe("uci");
  });
});
