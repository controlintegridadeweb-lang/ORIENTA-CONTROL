import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  total: number;
  singular: string;
  plural: string;
  averageProgress: number;
  withoutPlan: number;
  overdue: number;
};

export function AdminMonitoringOrganizationSummary({
  total,
  singular,
  plural,
  averageProgress,
  withoutPlan,
  overdue,
}: Props) {
  const progress = Math.min(100, Math.max(0, averageProgress));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
        {total} {total === 1 ? singular : plural}
      </span>
      <span className={`${formSurface.badge.base} ${formSurface.badge.brand}`}>
        Progresso médio {progress}%
      </span>
      {withoutPlan > 0 ? (
        <span className={`${formSurface.badge.base} ${formSurface.badge.warning}`}>
          {withoutPlan} aguardando ação
        </span>
      ) : null}
      {overdue > 0 ? (
        <span className={`${formSurface.badge.base} ${formSurface.badge.danger}`}>
          {overdue} atrasada{overdue === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
