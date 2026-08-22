import type { SectionActionPlanMetrics } from "@/features/improvement-management/action-plans/section-action-plan-model";
import { StatusPill } from "@/shared/ui/components/status-pill";
import { formSurface } from "@/shared/layout/form-surface";

export type SectionPlanStatus =
  | "empty"
  | "not_started"
  | "in_progress"
  | "attention"
  | "completed";

const PRESENTATION: Record<SectionPlanStatus, { label: string; tone: string }> = {
  empty: { label: "Sem ações ativas", tone: formSurface.badge.neutral },
  not_started: { label: "Não iniciado", tone: formSurface.badge.neutral },
  in_progress: { label: "Em execução", tone: formSurface.badge.info },
  attention: { label: "Requer atenção", tone: formSurface.badge.warning },
  completed: { label: "Concluído", tone: formSurface.badge.success },
};

export function sectionPlanStatusFromMetrics(metrics: SectionActionPlanMetrics): SectionPlanStatus {
  if (metrics.activeActions === 0) return "empty";
  if (metrics.completedActions === metrics.activeActions) return "completed";
  if (metrics.overdueActions > 0) return "attention";
  if (metrics.inProgressActions > 0 || metrics.completedActions > 0) return "in_progress";
  return "not_started";
}

export function sectionPlanStatusLabel(status: SectionPlanStatus): string {
  return PRESENTATION[status].label;
}

export function SectionPlanStatusBadge({ status }: { status: SectionPlanStatus }) {
  const meta = PRESENTATION[status];
  return (
    <StatusPill className={meta.tone} aria-label={`Situação do plano da seção: ${meta.label}`}>
      {meta.label}
    </StatusPill>
  );
}
