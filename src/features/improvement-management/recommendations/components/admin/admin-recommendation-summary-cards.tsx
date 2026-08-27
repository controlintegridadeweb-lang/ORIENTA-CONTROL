"use client";

import { AdminMonitoringSummaryCards } from "@/features/improvement-management/monitoring/components/admin-monitoring-summary-cards";
import type { AdminRecommendationSummary } from "@/features/improvement-management/recommendations/admin-presentation";
import type { AdminRecommendationCardFilter } from "@/features/improvement-management/monitoring/types";

type Props = {
  summary: AdminRecommendationSummary;
  activeFilter: AdminRecommendationCardFilter;
  onSelect: (filter: AdminRecommendationCardFilter) => void;
};

export function AdminRecommendationSummaryCards({ summary, activeFilter, onSelect }: Props) {
  return (
    <AdminMonitoringSummaryCards
      ariaLabel="Indicadores do portfólio"
      activeFilter={activeFilter}
      clearFilter={null}
      onSelect={onSelect}
      cards={[
        { id: null, label: "Total no escopo", value: summary.total, hint: "Recomendações visíveis com os filtros atuais", variant: "neutral" },
        { id: "without_plan", label: "Aguardando ação", value: summary.withoutPlan, hint: "Organização ainda não cadastrou ações", variant: "warning" },
        { id: "executing", label: "Em acompanhamento", value: summary.inExecution, hint: "Execução, ajustes, aceite ou exceção em análise", variant: "info" },
        { id: "completed", label: "Aprovadas", value: summary.completed, hint: "Execução aceita pela administração", variant: "success" },
        { id: "overdue", label: "Atrasadas", value: summary.overdue, hint: "Final vencido", variant: "danger" },
      ]}
    />
  );
}
