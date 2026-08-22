import { businessToday } from "@/shared/datetime/business-date";
import { workflowStatusLabel } from "@/shared/ui/status-registry";
import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import { createCsvContent } from "@/shared/export/csv";
import {
  buildRecommendationPortfolioCsv,
  buildRecommendationPortfolioExportRows,
  toPortfolioExportSourceFromAdmin,
} from "@/features/improvement-management/recommendations/export";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";

function planViewLabel(item: AdminPlanItem): string {
  return item.view === "overdue"
    ? "Em atraso"
    : workflowStatusLabel("action_plan", item.view);
}

export function actionPlansCsv(items: AdminPlanItem[]): { filename: string; content: string } {
  const headers = [
    "Organização",
    "Formulário",
    "Versão",
    "Eixo",
    "Seção",
    "Pergunta",
    "Recomendação",
    "Descrição da ação",
    "Situação de acompanhamento",
    "Situação da ação",
    "Responsável",
    "Setor",
    "Prazo",
    "Atualizado em",
    "Última atividade",
    "Atrasado",
    "Vence em 7 dias",
    "% progresso",
    "Observações",
  ];
  const rows = items.map((item) => [
    item.organizationName,
    item.formName,
    item.formVersion,
    item.axisName,
    item.sectionName,
    item.questionPrompt,
    item.recommendationText,
    item.actionText,
    planViewLabel(item),
    item.planStatus ? workflowStatusLabel("action_plan", item.planStatus) : "",
    item.responsibleName,
    item.responsibleSector,
    item.dueDate ?? "",
    item.updatedAt ?? "",
    item.lastActivityLabel,
    item.isOverdue ? "Sim" : "Não",
    item.isDueSoon ? "Sim" : "Não",
    item.progress,
    item.observations ?? "",
  ]);
  return {
    filename: `acoes-monitoradas-${businessToday()}.csv`,
    content: createCsvContent([headers, ...rows]),
  };
}

/**
 * CSV do portfólio admin: 1 linha por ação (contexto repetido),
 * na ordem lógica contexto → origem → recomendação → execução.
 */
export function recommendationsCsv(
  items: AdminRecommendationItem[],
): { filename: string; content: string } {
  const rows = buildRecommendationPortfolioExportRows(
    items.map(toPortfolioExportSourceFromAdmin),
  );
  return buildRecommendationPortfolioCsv(rows, "portfolio-recomendacoes");
}
