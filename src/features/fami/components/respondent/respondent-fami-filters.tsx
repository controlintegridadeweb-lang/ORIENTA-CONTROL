"use client";

import { YearSelect } from "@/shared/ui/components/year-select";
import type { FamiCycleOption } from "@/features/fami/client";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  cycles: FamiCycleOption[];
  scopeId: string;
  onScopeChange: (id: string) => void;
  availableYears: number[];
  snapshotYear: number | null;
  onSnapshotYearChange: (year: number | null) => void;
  filtersDisabled?: boolean;
};

/** Escopo do resultado — ações Atualizar/Exportar ficam no hero da página. */
export function RespondentFamiFilters({
  cycles,
  scopeId,
  onScopeChange,
  availableYears,
  snapshotYear,
  onSnapshotYearChange,
  filtersDisabled,
}: Props) {
  return (
    <div
      className={`${formSurface.dashboardPanel} overflow-hidden`}
      aria-label="Filtros do resultado FAMI"
    >
      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-4">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11.5rem] sm:gap-3">
          <label className={`min-w-0 ${formSurface.fieldGroup}`}>
            <span className={formSurface.label}>Diagnóstico</span>
            <select
              value={scopeId}
              onChange={(event) => onScopeChange(event.target.value)}
              disabled={filtersDisabled}
              className={`${formSurface.inputSelect} truncate`}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.formName} (v{cycle.formVersion}) · {cycle.periodLabel}
                </option>
              ))}
            </select>
          </label>

          <YearSelect
            id="fami-snapshot-year"
            label="Ano do processamento"
            years={availableYears}
            value={snapshotYear}
            onChange={onSnapshotYearChange}
            disabled={filtersDisabled}
          />
        </div>

        <p className="border-t border-slate-100 pt-3 text-micro leading-relaxed text-slate-500">
          O Resultado FAMI deste processamento é histórico: permanece oficial mesmo após
          reabertura ou novas evidências no diagnóstico. O acompanhamento quadrimestral
          estima a recuperação das ações sem alterar esse resultado oficial.
        </p>
      </div>
    </div>
  );
}
