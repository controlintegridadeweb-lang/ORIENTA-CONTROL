import { structuralAxisOrderIndex } from "@/shared/domain/axis";

/** Campos mínimos necessários para agrupar recomendações na hierarquia oficial. */
export type RecommendationHierarchySource = {
  recommendationId: string;
  axisId: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
};

export type RecommendationSectionGroup<T extends RecommendationHierarchySource> = {
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  /** Número de exibição da seção no eixo (1-based, após ordenação). */
  sectionDisplayNumber: number;
  recommendations: Array<T & { recommendationDisplayCode: string }>;
};

export type RecommendationAxisGroup<T extends RecommendationHierarchySource> = {
  axisId: string;
  axisName: string;
  axisOrder: number;
  sections: RecommendationSectionGroup<T>[];
};

type MutableSection<T extends RecommendationHierarchySource> = {
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  recommendations: T[];
};

type MutableAxis<T extends RecommendationHierarchySource> = {
  axisId: string;
  axisName: string;
  axisOrder: number;
  sections: Map<string, MutableSection<T>>;
};

function compareRecommendations<T extends RecommendationHierarchySource>(a: T, b: T): number {
  const questionDiff = a.questionOrder - b.questionOrder;
  if (questionDiff !== 0) return questionDiff;
  return a.recommendationId.localeCompare(b.recommendationId);
}

function compareSections(a: MutableSection<RecommendationHierarchySource>, b: MutableSection<RecommendationHierarchySource>): number {
  const orderDiff = a.sectionOrder - b.sectionOrder;
  if (orderDiff !== 0) return orderDiff;
  return a.sectionId.localeCompare(b.sectionId);
}

/**
 * Agrupa recomendações na hierarquia oficial do diagnóstico:
 * Eixo → Seção → Recomendações.
 *
 * Função pura: não consulta, não depende de React e não muta a entrada.
 * Ordena por eixo estrutural, section_order, question_order e id estável.
 * Omite eixos/seções sem recomendações (útil após filtros).
 */
export function groupRecommendationsByAxisAndSection<T extends RecommendationHierarchySource>(
  items: readonly T[],
): RecommendationAxisGroup<T>[] {
  const axes = new Map<string, MutableAxis<T>>();

  for (const item of items) {
    const axisKey = item.axisId || `__axis:${item.axisName}`;
    let axis = axes.get(axisKey);
    if (!axis) {
      axis = {
        axisId: item.axisId,
        axisName: item.axisName,
        axisOrder: structuralAxisOrderIndex(item.axisName),
        sections: new Map(),
      };
      axes.set(axisKey, axis);
    }

    const sectionKey = item.sectionId || `__section:${item.sectionName}`;
    let section = axis.sections.get(sectionKey);
    if (!section) {
      section = {
        sectionId: item.sectionId,
        sectionName: item.sectionName,
        sectionOrder: item.sectionOrder,
        recommendations: [],
      };
      axis.sections.set(sectionKey, section);
    }
    section.recommendations.push(item);
  }

  return Array.from(axes.values())
    .sort((a, b) => {
      const axisDiff = a.axisOrder - b.axisOrder;
      if (axisDiff !== 0) return axisDiff;
      return a.axisId.localeCompare(b.axisId);
    })
    .map((axis) => {
      const sections = Array.from(axis.sections.values())
        .sort(compareSections)
        .map((section, sectionIndex) => {
          const sectionDisplayNumber = sectionIndex + 1;
          const recommendations = [...section.recommendations]
            .sort(compareRecommendations)
            .map((recommendation, recommendationIndex) => ({
              ...recommendation,
              recommendationDisplayCode: `${sectionDisplayNumber}.${recommendationIndex + 1}`,
            }));

          return {
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            sectionOrder: section.sectionOrder,
            sectionDisplayNumber,
            recommendations,
          };
        })
        .filter((section) => section.recommendations.length > 0);

      return {
        axisId: axis.axisId,
        axisName: axis.axisName,
        axisOrder: axis.axisOrder,
        sections,
      };
    })
    .filter((axis) => axis.sections.length > 0);
}
