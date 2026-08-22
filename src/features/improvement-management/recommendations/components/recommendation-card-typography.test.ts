import { describe, expect, it } from "vitest";
import { recommendationCardType } from "./recommendation-card-typography";

describe("recommendationCardType", () => {
  it("define quatro níveis tipográficos estáveis", () => {
    expect(Object.keys(recommendationCardType).sort()).toEqual([
      "body",
      "highlight",
      "label",
      "meta",
      "metaSecondary",
    ].sort());
  });

  it("mantém rótulos em caixa alta com peso semibold", () => {
    expect(recommendationCardType.label).toContain("font-semibold");
    expect(recommendationCardType.label).toContain("uppercase");
    expect(recommendationCardType.label).toContain("text-xs");
  });

  it("mantém conteúdo comum em peso normal e tamanho base", () => {
    expect(recommendationCardType.body).toContain("font-normal");
    expect(recommendationCardType.body).toContain("text-sm");
    expect(recommendationCardType.meta).toContain("font-normal");
  });

  it("destaca a recomendação só com peso médio, sem semibold em parágrafo", () => {
    expect(recommendationCardType.highlight).toContain("font-medium");
    expect(recommendationCardType.highlight).toContain("text-sm");
    expect(recommendationCardType.highlight).not.toContain("font-semibold");
    expect(recommendationCardType.body).not.toContain("font-medium");
    expect(recommendationCardType.meta).not.toContain("font-medium");
  });
});
