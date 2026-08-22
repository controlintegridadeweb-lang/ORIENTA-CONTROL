import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { isExceptionalDeadline } from "@/features/cycles/form-management/domain";
import { formSurface } from "@/shared/layout/form-surface";

/** Card do órgão no Kanban do formulário selecionado. */
export function CycleCard({
  cycle,
  overdue = false,
  returnTo,
  showPeriod = false,
  periodBaseDeadlineAt = null,
}: {
  cycle: CycleListItem;
  overdue?: boolean;
  returnTo?: string;
  showPeriod?: boolean;
  /** Prazo-base do form_periods; diferença marca prazo excepcional. */
  periodBaseDeadlineAt?: string | null;
}) {
  const deadline = cycle.responseDeadlineAt
    ? formatPlatformDate(cycle.responseDeadlineAt, { dateStyle: "short" })
    : null;
  const k = formSurface.kanban;
  const badge = formSurface.badge;
  const suspended = Boolean(cycle.responseCollectionPausedAt);
  const differsFromPeriodBase = Boolean(
    periodBaseDeadlineAt &&
      cycle.responseDeadlineAt &&
      cycle.responseDeadlineAt !== periodBaseDeadlineAt,
  );
  const exceptionalDeadline =
    differsFromPeriodBase ||
    isExceptionalDeadline({
      id: cycle.id,
      organizationId: cycle.organizationId,
      state: cycle.state,
      responseDeadlineAt: cycle.responseDeadlineAt,
      originalResponseDeadlineAt: cycle.originalResponseDeadlineAt,
      responseCollectionPausedAt: cycle.responseCollectionPausedAt,
      deadlineChangeCount: cycle.deadlineChangeCount ?? 0,
      reopenCount: cycle.reopenCount,
      startsAt: cycle.startsAt,
      closedAt: cycle.closedAt,
    });
  const showOverdue = overdue && Boolean(deadline) && !suspended;

  return (
    <Link
      href={`/admin/ciclos/${cycle.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
      className={`${k.card} focus-visible:outline-brand-500`}
    >
      {showPeriod ? <p className={k.cardContext}>{cycle.periodLabel}</p> : null}
      <p className={k.cardTitle}>{cycle.organizationAcronym}</p>
      <p className="mt-0.5 truncate text-micro text-slate-500" title={cycle.organizationName}>
        {cycle.organizationName}
      </p>

      <div className={`${k.cardFooter} flex flex-wrap items-center gap-1.5`}>
        {cycle.state === "draft" && (
          <span
            className={`${badge.base} ${badge.warning}`}
            title="Defina as datas e abra o diagnóstico para o respondente poder responder."
          >
            Não visível ao respondente
          </span>
        )}
        {suspended ? (
          <span
            className={`${badge.base} ${badge.muted}`}
            title="Coleta suspensa administrativamente. O estado do ciclo não muda."
          >
            Suspenso
          </span>
        ) : null}
        {exceptionalDeadline ? (
          <span
            className={`${badge.base} ${badge.warning}`}
            title="Prazo diferente do prazo original/global deste formulário."
          >
            Prazo excepcional
          </span>
        ) : null}
        {showOverdue ? (
          <span className={`${badge.base} ${badge.danger}`}>Prazo vencido {deadline}</span>
        ) : null}
        {!showOverdue && !suspended && deadline ? (
          <span className="text-micro text-slate-500">Prazo: {deadline}</span>
        ) : null}
        {suspended && deadline ? (
          <span className="text-micro text-slate-500">Prazo: {deadline}</span>
        ) : null}
      </div>
    </Link>
  );
}
