"use client";

import { CheckCircle2, Inbox } from "lucide-react";
import {
  AdminMonitoringEmptyState,
  type AdminMonitoringEmptyStateConfig,
} from "@/features/improvement-management/monitoring/components/admin-monitoring-empty-state";

type EmptyKind = "none" | "no-results" | "all-have-plan" | "no-overdue";

type Props = { kind: EmptyKind; onClear?: () => void };

const CONFIG = {
  none: {
    icon: Inbox,
    title: "Nenhuma recomendação gerada ainda",
    description:
      "Os diagnósticos ainda não possuem recomendações oficiais. Elas aparecem após a validação e consolidação.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "no-results": {
    icon: Inbox,
    title: "Nenhuma recomendação corresponde aos filtros atuais",
    description:
      "Existem recomendações no recorte geral, mas nenhuma combina com os filtros selecionados. Ajuste ou limpe os filtros.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "all-have-plan": {
    icon: CheckCircle2,
    title: "Todas as recomendações já têm plano",
    description: "Nenhuma recomendação aguardando criação de plano de integridade e compliance no momento.",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-800",
  },
  "no-overdue": {
    icon: CheckCircle2,
    title: "Nenhuma recomendação atrasada",
    description: "Todos os planos vinculados estão com o final em dia.",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-800",
  },
} satisfies Record<EmptyKind, AdminMonitoringEmptyStateConfig>;

export function AdminRecommendationEmptyState({ kind, onClear }: Props) {
  return (
    <AdminMonitoringEmptyState
      kind={kind}
      config={CONFIG}
      onClear={kind === "no-results" ? onClear : undefined}
    />
  );
}
