"use client";

import { Search } from "lucide-react";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { formSurface } from "@/shared/layout/form-surface";
import type { ReportCycleOption } from "@/features/reports/ui/client";

export function ReportCycleSelector(props: {
  organizationId: string;
  cycles: ReportCycleOption[];
  cycleId: string;
  cycleSearch: string;
  cycleOffset: number;
  cycleTotal: number;
  cycleHasMore: boolean;
  pageSize: number;
  loading: boolean;
  generating: boolean;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (cycleId: string) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  const disabled = !props.organizationId || props.loading || props.generating;
  const showPagination = props.cycleTotal > props.pageSize;

  return (
    <>
      <div className={`min-w-0 ${formSurface.fieldGroup}`}>
        <label htmlFor="report-cycle" className={formSurface.label}>Diagnóstico</label>
        <select
          id="report-cycle"
          className={formSurface.inputSelect}
          value={props.cycleId}
          onChange={(event) => props.onSelect(event.target.value)}
          disabled={disabled || props.cycles.length === 0}
        >
          <option value="">
            {!props.organizationId
              ? "Selecione a organização"
              : props.loading
                ? "Carregando..."
                : props.cycles.length === 0
                  ? "Nenhum diagnóstico com FAMI concluído"
                  : "Selecione"}
          </option>
          {props.cycles.map((cycle) => (
            <option key={cycle.cycleId} value={cycle.cycleId}>
              {cycle.formName} · {cycle.periodLabel || "sem período"} · {cycleStateLabelOrFallback(cycle.cycleState)} · Processamento nº {cycle.latestProcessingVersion}
            </option>
          ))}
        </select>
      </div>

      <div className={`min-w-0 ${formSurface.fieldGroup}`}>
        <label htmlFor="report-cycle-search" className={formSurface.label}>Busca</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              id="report-cycle-search"
              type="search"
              className={`${formSurface.input} pl-9`}
              value={props.cycleSearch}
              onChange={(event) => props.onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  props.onSearch();
                }
              }}
              placeholder="Formulário ou período"
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            className={formSurface.secondaryButton}
            onClick={props.onSearch}
            disabled={disabled}
          >
            Buscar
          </button>
        </div>
      </div>

      {showPagination ? (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 md:col-span-2 lg:col-span-3">
          <span>
            {Math.min(props.cycleOffset + 1, props.cycleTotal)}–{Math.min(props.cycleOffset + props.pageSize, props.cycleTotal)} de {props.cycleTotal}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className={formSurface.secondaryButtonSm}
              onClick={props.onPreviousPage}
              disabled={props.cycleOffset === 0 || props.loading || props.generating}
            >
              Anterior
            </button>
            <button
              type="button"
              className={formSurface.secondaryButtonSm}
              onClick={props.onNextPage}
              disabled={!props.cycleHasMore || props.loading || props.generating}
            >
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
