import { describe, expect, it } from "vitest";
import {
  groupRecommendationsByAxisAndSection,
  type RecommendationHierarchySource,
} from "./group-recommendations-by-axis-section";

function item(
  over: Partial<RecommendationHierarchySource> & Pick<RecommendationHierarchySource, "recommendationId">,
): RecommendationHierarchySource {
  return {
    axisId: "axis-gov",
    axisName: "Governanca",
    sectionId: "section-1",
    sectionName: "Transparência",
    sectionOrder: 1,
    questionOrder: 1,
    ...over,
  };
}

describe("groupRecommendationsByAxisAndSection", () => {
  it("agrupa recomendações de vários eixos", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({
        recommendationId: "r-social",
        axisId: "axis-social",
        axisName: "Social",
        sectionId: "s-social",
        sectionName: "Pessoas",
        sectionOrder: 1,
      }),
      item({
        recommendationId: "r-gov",
        axisId: "axis-gov",
        axisName: "Governanca",
        sectionId: "s-gov",
        sectionName: "Ética",
        sectionOrder: 1,
      }),
    ]);

    expect(groups.map((g) => g.axisName)).toEqual(["Governanca", "Social"]);
    expect(groups).toHaveLength(2);
  });

  it("agrupa várias seções dentro do mesmo eixo", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({
        recommendationId: "r-2",
        sectionId: "s-2",
        sectionName: "Seção B",
        sectionOrder: 2,
      }),
      item({
        recommendationId: "r-1",
        sectionId: "s-1",
        sectionName: "Seção A",
        sectionOrder: 1,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.sections.map((s) => s.sectionName)).toEqual(["Seção A", "Seção B"]);
  });

  it("agrupa várias recomendações dentro da mesma seção", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({ recommendationId: "r-a", questionOrder: 2 }),
      item({ recommendationId: "r-b", questionOrder: 1 }),
    ]);

    expect(groups[0]?.sections).toHaveLength(1);
    expect(groups[0]?.sections[0]?.recommendations.map((r) => r.recommendationId)).toEqual([
      "r-b",
      "r-a",
    ]);
  });

  it("ordena eixos pela ordem estrutural oficial (não alfabética)", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({
        recommendationId: "r-s",
        axisId: "a-s",
        axisName: "Social",
        sectionId: "s-s",
      }),
      item({
        recommendationId: "r-a",
        axisId: "a-a",
        axisName: "Ambiental",
        sectionId: "s-a",
      }),
      item({
        recommendationId: "r-g",
        axisId: "a-g",
        axisName: "Governanca",
        sectionId: "s-g",
      }),
    ]);

    expect(groups.map((g) => g.axisName)).toEqual(["Governanca", "Ambiental", "Social"]);
    expect(groups.map((g) => g.axisOrder)).toEqual([0, 1, 2]);
  });

  it("ordena seções por sectionOrder oficial (não pelo nome)", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({
        recommendationId: "r-z",
        sectionId: "s-z",
        sectionName: "Aaa",
        sectionOrder: 3,
      }),
      item({
        recommendationId: "r-y",
        sectionId: "s-y",
        sectionName: "Zzz",
        sectionOrder: 1,
      }),
    ]);

    expect(groups[0]?.sections.map((s) => s.sectionName)).toEqual(["Zzz", "Aaa"]);
    expect(groups[0]?.sections.map((s) => s.sectionOrder)).toEqual([1, 3]);
  });

  it("ordena recomendações por questionOrder e depois por id", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({ recommendationId: "r-c", questionOrder: 1 }),
      item({ recommendationId: "r-a", questionOrder: 1 }),
      item({ recommendationId: "r-b", questionOrder: 0 }),
    ]);

    expect(groups[0]?.sections[0]?.recommendations.map((r) => r.recommendationId)).toEqual([
      "r-b",
      "r-a",
      "r-c",
    ]);
    expect(groups[0]?.sections[0]?.recommendations.map((r) => r.recommendationDisplayCode)).toEqual([
      "1.1",
      "1.2",
      "1.3",
    ]);
  });

  it("não exibe seção sem recomendação", () => {
    const groups = groupRecommendationsByAxisAndSection([
      item({ recommendationId: "r-1", sectionId: "s-1", sectionName: "Única", sectionOrder: 1 }),
    ]);

    expect(groups[0]?.sections).toHaveLength(1);
    expect(groups[0]?.sections[0]?.sectionName).toBe("Única");
  });

  it("não exibe eixo sem recomendações", () => {
    const groups = groupRecommendationsByAxisAndSection([]);
    expect(groups).toEqual([]);
  });

  it("mantém hierarquia Eixo → Seção após filtros (somente itens filtrados)", () => {
    const all = [
      item({
        recommendationId: "r-keep",
        axisId: "a-g",
        axisName: "Governanca",
        sectionId: "s-1",
        sectionName: "Ética",
        sectionOrder: 1,
      }),
      item({
        recommendationId: "r-drop",
        axisId: "a-s",
        axisName: "Social",
        sectionId: "s-2",
        sectionName: "Pessoas",
        sectionOrder: 1,
      }),
    ];
    const filtered = all.filter((row) => row.recommendationId === "r-keep");
    const groups = groupRecommendationsByAxisAndSection(filtered);

    expect(groups.map((g) => g.axisName)).toEqual(["Governanca"]);
    expect(groups[0]?.sections.map((s) => s.sectionName)).toEqual(["Ética"]);
    expect(groups[0]?.sections[0]?.recommendations).toHaveLength(1);
  });

  it("diagnóstico sem recomendações resulta em lista vazia", () => {
    expect(groupRecommendationsByAxisAndSection([])).toEqual([]);
  });

  it("não muta o array nem os objetos de entrada", () => {
    const source = [
      item({ recommendationId: "r-2", questionOrder: 2 }),
      item({ recommendationId: "r-1", questionOrder: 1 }),
    ];
    const snapshot = structuredClone(source);

    groupRecommendationsByAxisAndSection(source);

    expect(source).toEqual(snapshot);
    expect(source.map((row) => row.recommendationId)).toEqual(["r-2", "r-1"]);
  });
});
