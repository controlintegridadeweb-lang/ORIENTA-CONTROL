"use client";

import { useMemo } from "react";
import { formSurface } from "@/shared/layout/form-surface";
import { YearSelect } from "@/shared/ui/components/year-select";
import { ResponsiveFilterPanel } from "@/shared/ui/components/responsive-filter-panel";
import type { ReportCatalogKind } from "@/features/reports/report-catalog";
import { reportCatalogLabels } from "@/shared/labels/official-labels";

export type HistoryFilterState = {
  search: string;
  status: "" | "completed" | "outdated";
  kind: "" | ReportCatalogKind;
  from: string;
  to: string;
  /** Ano contido no período institucional de referência do diagnóstico. */
  yearPreset: number | null;
};

export const INITIAL_HISTORY_FILTERS: HistoryFilterState = {
  search: "",
  status: "",
  kind: "",
  from: "",
  to: "",
  yearPreset: null,
};

function hasActiveHistoryFilters(value: HistoryFilterState): boolean {
  return Boolean(
    value.search.trim() ||
      value.status ||
      value.kind ||
      value.from ||
      value.to ||
      value.yearPreset != null,
  );
}

type Props = {
  value: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
  onClear: () => void;
  availableYears: number[];
};

export function RespondentReportsFilters({ value, onChange, onClear, availableYears }: Props) {
  const active = useMemo(() => hasActiveHistoryFilters(value), [value]);

  function patch(next: Partial<HistoryFilterState>) {
    onChange({ ...value, ...next });
  }

  return (
    <ResponsiveFilterPanel
      ariaLabel="Filtros do histórico"
      searchValue={value.search}
      onSearchChange={(search) => patch({ search })}
      searchPlaceholder="Nome do formulário…"
      active={active}
      onClear={onClear}
      clearLabel="Limpar filtros"
      surfaceClassName="rounded-xl border border-slate-200/80 bg-slate-50/40 shadow-card"
    >
      <YearSelect
        id="reports-history-year"
        label="Ano"
        hint="Filtra relatórios cujo período institucional contém o ano selecionado."
        years={availableYears}
        value={value.yearPreset}
        onChange={(year) => patch({ yearPreset: year })}
      />

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>{reportCatalogLabels.typeFilter}</span>
        <select
          value={value.kind}
          onChange={(event) => patch({ kind: event.target.value as HistoryFilterState["kind"] })}
          className={formSurface.inputSelect}
        >
          <option value="">{reportCatalogLabels.allTypes}</option>
          <option value="annual">{reportCatalogLabels.annual}</option>
          <option value="bimonthly">{reportCatalogLabels.bimonthly}</option>
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Situação</span>
        <select
          value={value.status}
          onChange={(event) => patch({ status: event.target.value as HistoryFilterState["status"] })}
          className={formSurface.inputSelect}
        >
          <option value="">Todos</option>
          <option value="completed">Gerado</option>
          <option value="outdated">Desatualizado</option>
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>De</span>
        <input
          type="date"
          value={value.from}
          onChange={(event) => patch({ yearPreset: null, from: event.target.value })}
          className={formSurface.input}
        />
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Até</span>
        <input
          type="date"
          value={value.to}
          onChange={(event) => patch({ yearPreset: null, to: event.target.value })}
          className={formSurface.input}
        />
      </label>
    </ResponsiveFilterPanel>
  );
}
