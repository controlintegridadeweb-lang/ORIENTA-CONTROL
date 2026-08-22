"use client";

import { Inbox, ShieldCheck } from "lucide-react";
import {
  AdminMonitoringEmptyState,
  type AdminMonitoringEmptyStateConfig,
} from "@/features/improvement-management/monitoring/components/admin-monitoring-empty-state";

type EmptyKind = "none" | "no-results" | "no-overdue";

type Props = { kind: EmptyKind; onClear?: () => void };

const CONFIG = {
  none: {
    icon: Inbox,
    title: "Nenhum plano cadastrado ainda",
    description: "Quando as organizações cadastrarem planos para as recomendações, eles aparecerão aqui.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "no-results": {
    icon: Inbox,
    title: "Nenhum plano com os filtros atuais",
    description: "Ajuste ou limpe os filtros para ver mais resultados.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "no-overdue": {
    icon: ShieldCheck,
    title: "Nenhum plano atrasado",
    description: "Todas as ações vinculadas estão dentro do prazo.",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-800",
  },
} satisfies Record<EmptyKind, AdminMonitoringEmptyStateConfig>;

export function AdminActionPlanEmptyState({ kind, onClear }: Props) {
  return (
    <AdminMonitoringEmptyState
      kind={kind}
      config={CONFIG}
      onClear={kind === "no-results" ? onClear : undefined}
    />
  );
}
