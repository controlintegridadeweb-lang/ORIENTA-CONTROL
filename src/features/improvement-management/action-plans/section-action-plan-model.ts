import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import type { ActionPlanAction } from "./domain-model";

export type SectionActionPlanSource = {
  cycleId: string;
  formName: string;
  periodLabel: string;
  organizationName: string;
  axisId: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
  recommendationId: string;
  questionPrompt: string;
  recommendationText: string;
  actions: ActionPlanAction[];
};

export type SectionActionPlanRecommendation = {
  recommendationId: string;
  questionOrder: number;
  questionPrompt: string;
  recommendationText: string;
  actions: ActionPlanAction[];
};

export type SectionActionPlanMetrics = {
  totalActions: number;
  activeActions: number;
  notStartedActions: number;
  inProgressActions: number;
  completedActions: number;
  cancelledActions: number;
  overdueActions: number;
  progressPercentage: number;
};

export type SectionActionPlanGroup = {
  key: string;
  cycleId: string;
  formName: string;
  periodLabel: string;
  organizationName: string;
  axisId: string;
  axisName: string;
  axisOrder: number;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  sectionDisplayNumber: number;
  recommendations: SectionActionPlanRecommendation[];
  actions: Array<ActionPlanAction & { recommendationId: string }>;
  metrics: SectionActionPlanMetrics;
};

export type SectionActionPlanAxisGroup = {
  key: string;
  cycleId: string;
  formName: string;
  periodLabel: string;
  organizationName: string;
  axisId: string;
  axisName: string;
  axisOrder: number;
  sections: SectionActionPlanGroup[];
};

type MutableRecommendation = Omit<SectionActionPlanRecommendation, "actions"> & {
  actions: Map<string, ActionPlanAction>;
};

type MutableSection = Omit<SectionActionPlanGroup, "recommendations" | "actions" | "metrics" | "sectionDisplayNumber"> & {
  recommendations: Map<string, MutableRecommendation>;
};

type MutableAxis = Omit<SectionActionPlanAxisGroup, "sections"> & {
  sections: Map<string, MutableSection>;
};

function computeMetrics(actions: readonly ActionPlanAction[]): SectionActionPlanMetrics {
  let activeActions = 0;
  let notStartedActions = 0;
  let inProgressActions = 0;
  let completedActions = 0;
  let cancelledActions = 0;
  let overdueActions = 0;
  let progressSum = 0;

  for (const action of actions) {
    if (action.status === "cancelled") {
      cancelledActions += 1;
      continue;
    }
    activeActions += 1;
    progressSum += action.progressPercentage;
    if (action.progressPercentage >= 100 || action.status === "completed") {
      completedActions += 1;
    } else if (action.progressPercentage > 0) {
      inProgressActions += 1;
    } else {
      notStartedActions += 1;
    }
    if (action.slaLabel === "overdue" && action.progressPercentage < 100) {
      overdueActions += 1;
    }
  }

  return {
    totalActions: actions.length,
    activeActions,
    notStartedActions,
    inProgressActions,
    completedActions,
    cancelledActions,
    overdueActions,
    progressPercentage: activeActions === 0 ? 0 : Math.round(progressSum / activeActions),
  };
}

function sourceScopeKey(source: SectionActionPlanSource): string {
  return `${source.cycleId}\u0000${source.axisId || source.axisName}`;
}

function sourceSectionKey(source: SectionActionPlanSource): string {
  return `${source.cycleId}\u0000${source.sectionId || source.sectionName}`;
}

function compareActions(a: ActionPlanAction, b: ActionPlanAction): number {
  const byUpdated = String(a.updatedAt).localeCompare(String(b.updatedAt));
  return byUpdated || a.id.localeCompare(b.id);
}

/**
 * Read model de apresentação do Plano de ação na lógica de guarda-chuva:
 * Diagnóstico → Eixo → Seção → Plano da seção → Ações.
 *
 * A recomendação continua como vínculo de origem de cada ação, mas deixa de ser
 * o agrupador principal da execução. Nenhum dado é persistido ou duplicado.
 */
export function buildSectionActionPlanHierarchy(
  sources: readonly SectionActionPlanSource[],
): SectionActionPlanAxisGroup[] {
  const axes = new Map<string, MutableAxis>();

  for (const source of sources) {
    const axisKey = sourceScopeKey(source);
    let axis = axes.get(axisKey);
    if (!axis) {
      axis = {
        key: axisKey,
        cycleId: source.cycleId,
        formName: source.formName,
        periodLabel: source.periodLabel,
        organizationName: source.organizationName,
        axisId: source.axisId,
        axisName: source.axisName,
        axisOrder: structuralAxisOrderIndex(source.axisName),
        sections: new Map(),
      };
      axes.set(axisKey, axis);
    }

    const sectionKey = sourceSectionKey(source);
    let section = axis.sections.get(sectionKey);
    if (!section) {
      section = {
        key: sectionKey,
        cycleId: source.cycleId,
        formName: source.formName,
        periodLabel: source.periodLabel,
        organizationName: source.organizationName,
        axisId: source.axisId,
        axisName: source.axisName,
        axisOrder: axis.axisOrder,
        sectionId: source.sectionId,
        sectionName: source.sectionName,
        sectionOrder: source.sectionOrder,
        recommendations: new Map(),
      };
      axis.sections.set(sectionKey, section);
    } else if (source.sectionOrder < section.sectionOrder) {
      section.sectionOrder = source.sectionOrder;
    }

    let recommendation = section.recommendations.get(source.recommendationId);
    if (!recommendation) {
      recommendation = {
        recommendationId: source.recommendationId,
        questionOrder: source.questionOrder,
        questionPrompt: source.questionPrompt,
        recommendationText: source.recommendationText,
        actions: new Map(),
      };
      section.recommendations.set(source.recommendationId, recommendation);
    }
    for (const action of source.actions) {
      recommendation.actions.set(action.id, action);
    }
  }

  return [...axes.values()]
    .sort((a, b) =>
      a.cycleId.localeCompare(b.cycleId) ||
      a.axisOrder - b.axisOrder ||
      a.axisName.localeCompare(b.axisName, "pt-BR"),
    )
    .map((axis) => {
      const sections = [...axis.sections.values()]
        .sort((a, b) => a.sectionOrder - b.sectionOrder || a.sectionName.localeCompare(b.sectionName, "pt-BR"))
        .map((section, sectionIndex) => {
          const recommendations = [...section.recommendations.values()]
            .sort((a, b) => a.questionOrder - b.questionOrder || a.recommendationId.localeCompare(b.recommendationId))
            .map((recommendation) => ({
              ...recommendation,
              actions: [...recommendation.actions.values()].sort(compareActions),
            }));
          const actions = recommendations.flatMap((recommendation) =>
            recommendation.actions.map((action) => ({
              ...action,
              recommendationId: recommendation.recommendationId,
            })),
          );
          return {
            ...section,
            sectionDisplayNumber:
              Number.isFinite(section.sectionOrder) && section.sectionOrder >= 1
                ? section.sectionOrder
                : sectionIndex + 1,
            recommendations,
            actions,
            metrics: computeMetrics(actions),
          };
        });
      return { ...axis, sections };
    });
}


export type SectionActionPlanItemLike = {
  cycleId?: string;
  formName: string;
  periodLabel?: string;
  organizationName: string;
  axisId?: string;
  axisName: string;
  sectionId: string;
  sectionName: string;
  sectionOrder: number;
  questionOrder: number;
  recommendationId: string;
  questionPrompt: string;
  recommendationText: string;
  plans: ActionPlanAction[];
};

export function sectionActionPlanSourcesFromListItems(
  items: readonly SectionActionPlanItemLike[],
): SectionActionPlanSource[] {
  return items.map((item) => ({
    cycleId: item.cycleId ?? "",
    formName: item.formName,
    periodLabel: item.periodLabel ?? "",
    organizationName: item.organizationName,
    axisId: item.axisId ?? "",
    axisName: item.axisName,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    sectionOrder: item.sectionOrder,
    questionOrder: item.questionOrder,
    recommendationId: item.recommendationId,
    questionPrompt: item.questionPrompt,
    recommendationText: item.recommendationText,
    actions: item.plans,
  }));
}

export function findSectionActionPlan(
  hierarchy: readonly SectionActionPlanAxisGroup[],
  cycleId: string,
  sectionId: string,
): SectionActionPlanGroup | null {
  for (const axis of hierarchy) {
    if (axis.cycleId !== cycleId) continue;
    const section = axis.sections.find((candidate) => candidate.sectionId === sectionId);
    if (section) return section;
  }
  return null;
}
