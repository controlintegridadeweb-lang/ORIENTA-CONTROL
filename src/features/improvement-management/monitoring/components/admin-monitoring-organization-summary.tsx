import { typography } from "@/shared/layout/design-system";

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
  return (
    <p className={`${typography.meta} leading-relaxed`}>
      {total} {total === 1 ? singular : plural} · progresso médio{" "}
      <span className="font-semibold tabular-nums text-slate-800">
        {averageProgress}%
      </span>
      {withoutPlan > 0 ? (
        <>
          {" "}·{" "}
          <span className="font-medium text-amber-800">
            {withoutPlan} aguardando ação
          </span>
        </>
      ) : null}
      {overdue > 0 ? (
        <>
          {" "}·{" "}
          <span className="font-medium text-rose-700">
            {overdue} atrasada(s)
          </span>
        </>
      ) : null}
    </p>
  );
}
