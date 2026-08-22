import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { workflowStatusLabel } from "@/shared/ui/status-registry";
import type {
  RecommendationPortfolioExportRow,
  RecommendationPortfolioExportSource,
} from "./portfolio-export-types";

/** Converte data civil `YYYY-MM-DD` em Date estável (meio-dia UTC). */
export function civilDateFromIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formVersionLabel(formVersion: number): string | null {
  return formVersion > 0 ? String(formVersion) : null;
}

function actionResponsible(action: ActionPlanAction): string | null {
  const name = action.responsibleName.trim();
  if (name) return name;
  const sector = action.responsibleSector.trim();
  return sector || null;
}

/** Ordem estável das ações na exportação: início → final → id. */
function sortActionsForExport(plans: ActionPlanAction[]): ActionPlanAction[] {
  return [...plans].sort((a, b) => {
    const start = a.startDate.localeCompare(b.startDate);
    if (start !== 0) return start;
    const due = a.dueDate.localeCompare(b.dueDate);
    if (due !== 0) return due;
    return a.id.localeCompare(b.id);
  });
}

function compareExportRows(
  a: RecommendationPortfolioExportRow,
  b: RecommendationPortfolioExportRow,
): number {
  return (
    a.formName.localeCompare(b.formName, "pt-BR") ||
    a.period.localeCompare(b.period, "pt-BR") ||
    a.organizationName.localeCompare(b.organizationName, "pt-BR") ||
    structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName) ||
    a.axisName.localeCompare(b.axisName, "pt-BR") ||
    a.sort.sectionOrder - b.sort.sectionOrder ||
    a.sectionName.localeCompare(b.sectionName, "pt-BR") ||
    a.sort.questionOrder - b.sort.questionOrder ||
    a.sort.recommendationId.localeCompare(b.sort.recommendationId) ||
    a.sort.actionOrder - b.sort.actionOrder ||
    (a.sort.actionId ?? "").localeCompare(b.sort.actionId ?? "")
  );
}

function rowFromSource(
  source: RecommendationPortfolioExportSource,
  action: ActionPlanAction | null,
  actionOrder: number,
): RecommendationPortfolioExportRow {
  const progressPercent = action == null ? null : action.progressPercentage;
  return {
    formName: source.formName,
    formVersion: formVersionLabel(source.formVersion),
    period: source.periodLabel,
    organizationName: source.organizationName,
    axisName: source.axisName,
    sectionName: source.sectionName,
    questionText: source.questionPrompt,
    recommendationText: source.recommendationText,
    recommendationStatus: workflowStatusLabel(
      "recommendation",
      source.recommendationStatus,
    ),
    actionTitle: action?.actionText.trim() ? action.actionText : null,
    responsibleName: action ? actionResponsible(action) : null,
    startDate: action ? civilDateFromIso(action.startDate) : null,
    endDate: action ? civilDateFromIso(action.dueDate) : null,
    actionStatus: action
      ? workflowStatusLabel("action_plan", action.status)
      : null,
    progress: progressPercent == null ? null : progressPercent / 100,
    progressPercent,
    updatedAt: action ? parseTimestamp(action.updatedAt) : null,
    sort: {
      recommendationId: source.recommendationId,
      sectionOrder: source.sectionOrder,
      questionOrder: source.questionOrder,
      actionOrder,
      actionId: action?.id ?? null,
    },
  };
}

/**
 * Expande recomendações em linhas tabulares (1 linha por ação; sem ação → 1 linha).
 * Usa apenas os `plans` já presentes na fonte — sem N+1.
 */
export function buildRecommendationPortfolioExportRows(
  sources: readonly RecommendationPortfolioExportSource[],
): RecommendationPortfolioExportRow[] {
  const rows: RecommendationPortfolioExportRow[] = [];

  for (const source of sources) {
    const actions = sortActionsForExport(source.plans);
    if (actions.length === 0) {
      rows.push(rowFromSource(source, null, 0));
      continue;
    }
    actions.forEach((action, index) => {
      rows.push(rowFromSource(source, action, index));
    });
  }

  return rows.sort(compareExportRows);
}

export function toPortfolioExportSourceFromAdmin(
  item: AdminRecommendationItem,
): RecommendationPortfolioExportSource {
  return {
    recommendationId: item.recommendationId,
    formName: item.formName,
    formVersion: item.formVersion,
    periodLabel: item.periodLabel,
    organizationName: item.organizationName,
    axisName: item.axisName,
    sectionName: item.sectionName,
    sectionOrder: item.sectionOrder,
    questionOrder: item.questionOrder,
    questionPrompt: item.questionPrompt,
    recommendationText: item.recommendationText,
    recommendationStatus: item.recommendationStatus,
    plans: item.plans,
  };
}

export function toPortfolioExportSourceFromRespondent(
  item: RespondentRecommendationItem,
): RecommendationPortfolioExportSource {
  return {
    recommendationId: item.recommendationId,
    formName: item.formName,
    formVersion: item.formVersion,
    periodLabel: item.periodLabel,
    organizationName: item.organizationName,
    axisName: item.axisName,
    sectionName: item.sectionName,
    sectionOrder: item.sectionOrder,
    questionOrder: item.questionOrder,
    questionPrompt: item.questionPrompt,
    recommendationText: item.recommendationText,
    recommendationStatus: item.status,
    plans: item.plans,
  };
}
