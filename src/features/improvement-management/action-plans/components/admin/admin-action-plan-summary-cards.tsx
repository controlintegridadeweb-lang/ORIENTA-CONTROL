"use client";

import { AdminMonitoringSummaryCards } from "@/features/improvement-management/monitoring/components/admin-monitoring-summary-cards";
import type { AdminPlanSummary } from "@/features/improvement-management/action-plans/admin-monitoring";
import type { AdminPlanCardFilter } from "@/features/improvement-management/monitoring/types";

type Props = {
  summary: AdminPlanSummary;
  activeFilter: AdminPlanCardFilter;
  onSelect: (filter: AdminPlanCardFilter) => void;
};

export function AdminActionPlanSummaryCards({ summary, activeFilter, onSelect }: Props) {
  return (
    <AdminMonitoringSummaryCards
      ariaLabel="Indicadores do plano de ação"
      gridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      activeFilter={activeFilter}
      clearFilter={null}
      onSelect={onSelect}
      cards={[
        { id: null, label: "Total no escopo", value: summary.total, hint: "Todas as ações visíveis com os filtros atuais", variant: "neutral" },
        { id: "in_progress", label: "Em andamento", value: summary.inProgress, hint: "Ações com plano em execução", variant: "info" },
        { id: "completed", label: "Concluídos", value: summary.completed, hint: "Ações finalizadas", variant: "success" },
        { id: "overdue", label: "Atrasados", value: summary.overdue, hint: "Prazo vencido ou situação crítica", variant: "danger" },
      ]}
    />
  );
}
