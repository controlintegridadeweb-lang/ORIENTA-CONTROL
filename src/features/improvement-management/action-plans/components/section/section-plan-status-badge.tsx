import {
  sectionPlanStatusFromMetrics,
  sectionPlanStatusFromSection,
  type SectionPlanStatus,
} from "@/features/improvement-management/action-plans/section-action-plan-status";
import { StatusPill } from "@/shared/ui/components/status-pill";
import { formSurface } from "@/shared/layout/form-surface";

export {
  sectionPlanStatusFromMetrics,
  sectionPlanStatusFromSection,
  type SectionPlanStatus,
};

const PRESENTATION: Record<SectionPlanStatus, { label: string; tone: string }> = {
  empty: { label: "Sem ações ativas", tone: formSurface.badge.neutral },
  not_started: { label: "Não iniciado", tone: formSurface.badge.neutral },
  in_progress: { label: "Em execução", tone: formSurface.badge.info },
  attention: { label: "Requer atenção", tone: formSurface.badge.warning },
  awaiting_acceptance: {
    label: "Execução concluída · aguardando aceite",
    tone: formSurface.badge.warning,
  },
  completed: { label: "Concluído", tone: formSurface.badge.success },
};

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
