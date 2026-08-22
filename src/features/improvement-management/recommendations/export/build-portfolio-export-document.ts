import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import type {
  RecommendationPortfolioExportActionView,
  RecommendationPortfolioExportAxisView,
  RecommendationPortfolioExportContextView,
  RecommendationPortfolioExportDocument,
  RecommendationPortfolioExportRecommendationView,
  RecommendationPortfolioExportRow,
  RecommendationPortfolioExportSectionView,
} from "./portfolio-export-types";
import { PORTFOLIO_EXPORT_MISSING_VALUE } from "./portfolio-export-types";

const CIVIL_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

type MutableRecommendation = RecommendationPortfolioExportRecommendationView & {
  questionOrder: number;
};

type MutableSection = {
  sectionName: string;
  sectionOrder: number;
  recommendations: Map<string, MutableRecommendation>;
};

type MutableAxis = {
  axisName: string;
  sections: Map<string, MutableSection>;
};

type MutableContext = {
  formName: string;
  formVersion: string | null;
  period: string;
  organizationName: string;
  axes: Map<string, MutableAxis>;
};

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : PORTFOLIO_EXPORT_MISSING_VALUE;
}

function formatExportDate(value: Date | null): string {
  if (!value) return PORTFOLIO_EXPORT_MISSING_VALUE;
  return formatPlatformDate(value, CIVIL_DATE_FORMAT, PORTFOLIO_EXPORT_MISSING_VALUE);
}

function formatProgress(percent: number | null): string {
  if (percent == null) return PORTFOLIO_EXPORT_MISSING_VALUE;
  return `${percent}%`;
}

function contextKey(row: RecommendationPortfolioExportRow): string {
  return `${row.formName}\u0000${row.period}\u0000${row.organizationName}\u0000${row.formVersion ?? ""}`;
}

function actionViewFromRow(
  row: RecommendationPortfolioExportRow,
): RecommendationPortfolioExportActionView {
  return {
    title: displayText(row.actionTitle),
    responsible: displayText(row.responsibleName),
    startDate: formatExportDate(row.startDate),
    endDate: formatExportDate(row.endDate),
    status: displayText(row.actionStatus),
    progress: formatProgress(row.progressPercent),
    updatedAt: formatExportDate(row.updatedAt),
  };
}

function ensureContext(
  contexts: Map<string, MutableContext>,
  row: RecommendationPortfolioExportRow,
): MutableContext {
  const key = contextKey(row);
  let context = contexts.get(key);
  if (!context) {
    context = {
      formName: row.formName,
      formVersion: row.formVersion,
      period: row.period,
      organizationName: row.organizationName,
      axes: new Map(),
    };
    contexts.set(key, context);
  }
  return context;
}

function ensureAxis(context: MutableContext, row: RecommendationPortfolioExportRow): MutableAxis {
  const axisName = displayText(row.axisName);
  let axis = context.axes.get(axisName);
  if (!axis) {
    axis = { axisName, sections: new Map() };
    context.axes.set(axisName, axis);
  }
  return axis;
}

function ensureSection(axis: MutableAxis, row: RecommendationPortfolioExportRow): MutableSection {
  const key = `${row.sort.sectionOrder}\u0000${row.sectionName}`;
  let section = axis.sections.get(key);
  if (!section) {
    section = {
      sectionName: displayText(row.sectionName),
      sectionOrder: row.sort.sectionOrder,
      recommendations: new Map(),
    };
    axis.sections.set(key, section);
  }
  return section;
}

function ensureRecommendation(
  section: MutableSection,
  row: RecommendationPortfolioExportRow,
): MutableRecommendation {
  const key = row.sort.recommendationId;
  let recommendation = section.recommendations.get(key);
  if (!recommendation) {
    recommendation = {
      questionText: displayText(row.questionText),
      recommendationText: displayText(row.recommendationText),
      recommendationStatus: displayText(row.recommendationStatus),
      actions: [],
      questionOrder: row.sort.questionOrder,
    };
    section.recommendations.set(key, recommendation);
  }
  return recommendation;
}

function freezeRecommendation(
  recommendation: MutableRecommendation,
): RecommendationPortfolioExportRecommendationView {
  return {
    questionText: recommendation.questionText,
    recommendationText: recommendation.recommendationText,
    recommendationStatus: recommendation.recommendationStatus,
    actions: recommendation.actions,
  };
}

function freezeSection(
  section: MutableSection,
  sectionDisplayNumber: number,
): RecommendationPortfolioExportSectionView {
  return {
    sectionName: section.sectionName,
    sectionDisplayNumber:
      Number.isFinite(section.sectionOrder) && section.sectionOrder >= 1
        ? section.sectionOrder
        : sectionDisplayNumber,
    recommendations: [...section.recommendations.values()].map(freezeRecommendation),
  };
}

function freezeAxis(axis: MutableAxis): RecommendationPortfolioExportAxisView {
  return {
    axisName: axis.axisName,
    sections: [...axis.sections.values()].map((section, index) =>
      freezeSection(section, index + 1),
    ),
  };
}

function freezeContext(context: MutableContext): RecommendationPortfolioExportContextView {
  return {
    formName: displayText(context.formName),
    formVersion: context.formVersion,
    period: displayText(context.period),
    organizationName: displayText(context.organizationName),
    axes: [...context.axes.values()].map(freezeAxis),
  };
}

/**
 * Agrupa linhas tabulares na hierarquia do relatório PDF.
 * Preserva a ordem já definida por `buildRecommendationPortfolioExportRows`.
 * Não relê status, datas ou progresso — só apresenta os valores já resolvidos.
 */
export function buildRecommendationPortfolioExportDocument(
  rows: readonly RecommendationPortfolioExportRow[],
): RecommendationPortfolioExportDocument {
  const contexts = new Map<string, MutableContext>();

  for (const row of rows) {
    const context = ensureContext(contexts, row);
    const axis = ensureAxis(context, row);
    const section = ensureSection(axis, row);
    const recommendation = ensureRecommendation(section, row);
    if (row.sort.actionId) {
      recommendation.actions.push(actionViewFromRow(row));
    }
  }

  return { contexts: [...contexts.values()].map(freezeContext) };
}
