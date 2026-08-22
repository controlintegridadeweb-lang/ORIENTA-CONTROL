import type { CyclePhase, StateGroup } from "@/features/cycles/dashboard-model";
import { PHASE_LABEL } from "@/features/cycles/dashboard-model";
import { formSurface } from "@/shared/layout/form-surface";
import { CycleCard } from "./CycleCard";

const PHASE_ACCENT: Record<CyclePhase, string> = {
  construcao: "bg-slate-300",
  resposta: "bg-sky-300",
  validacao: "bg-cyan-300",
  acompanhamento: "bg-emerald-300",
  encerrado: "bg-slate-300",
};

export function StateColumn({
  group,
  isOverdue,
  detailReturnTo,
  showPeriodOnCards = false,
  periodBaseDeadlineAt = null,
}: {
  group: StateGroup;
  isOverdue: (cycleId: string) => boolean;
  detailReturnTo?: string;
  showPeriodOnCards?: boolean;
  periodBaseDeadlineAt?: string | null;
}) {
  const k = formSurface.kanban;

  return (
    <article aria-label={group.label} className={k.column}>
      <div className={`${k.columnAccent} ${PHASE_ACCENT[group.phase]}`} aria-hidden />
      <header className={k.columnHeader}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className={k.columnTitle}>{group.label}</h2>
            <p className={k.columnDescription}>{PHASE_LABEL[group.phase]}</p>
          </div>
          <span className={k.columnCount} aria-label={`${group.count} órgãos`}>
            {group.count}
          </span>
        </div>
      </header>

      <div className={k.columnBody}>
        {group.cycles.length === 0 ? (
          <div className={k.empty}>Nenhum órgão nesta etapa</div>
        ) : (
          group.cycles.map((cycle) => (
            <CycleCard
              key={cycle.id}
              cycle={cycle}
              overdue={isOverdue(cycle.id)}
              returnTo={detailReturnTo}
              showPeriod={showPeriodOnCards}
              periodBaseDeadlineAt={periodBaseDeadlineAt}
            />
          ))
        )}
      </div>
    </article>
  );
}
