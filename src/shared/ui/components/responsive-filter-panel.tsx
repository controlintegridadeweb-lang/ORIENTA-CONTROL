"use client";

import { ChevronDown, Filter, Search, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

type ResultLabels = { singular: string; plural: string };

type Props = {
  ariaLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  active: boolean;
  onClear: () => void;
  children: ReactNode;
  gridClassName?: string;
  clearLabel?: string;
  resultCount?: number;
  resultLabels?: ResultLabels;
  surfaceClassName?: string;
  scope?: ReactNode;
  footer?: ReactNode;
};

export function ResponsiveFilterPanel({
  ariaLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  active,
  onClear,
  children,
  gridClassName = "sm:grid-cols-2 lg:grid-cols-4",
  clearLabel = "Limpar",
  resultCount,
  resultLabels,
  surfaceClassName = "rounded-xl border border-slate-200 bg-white shadow-sm",
  scope,
  footer,
}: Props) {
  const [expandedMobile, setExpandedMobile] = useState(false);
  const gridId = useId();

  return (
    <section aria-label={ariaLabel} className={surfaceClassName}>
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative w-full min-w-0 flex-1">
            <span className="sr-only">Buscar</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className={`${formSurface.input} pl-9`}
            />
          </label>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setExpandedMobile((current) => !current)}
              className={`${formSurface.secondaryButtonSm} w-full justify-center sm:hidden`}
              aria-expanded={expandedMobile}
              aria-controls={gridId}
            >
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Filtros
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${expandedMobile ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {active ? (
              <button
                type="button"
                onClick={onClear}
                className={`${formSurface.ghostButton} w-full justify-center text-rose-700 hover:bg-rose-50 sm:w-auto`}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {clearLabel}
              </button>
            ) : null}
          </div>
        </div>

        {scope}

        <div
          id={gridId}
          className={`${expandedMobile ? "grid" : "hidden"} grid-cols-1 gap-3 sm:grid ${gridClassName}`}
        >
          {children}
        </div>

        {footer || (typeof resultCount === "number" && resultLabels) ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {footer ?? <span />}
            {typeof resultCount === "number" && resultLabels ? (
              <p className="text-xs text-slate-500">
                {resultCount === 1
                  ? `1 ${resultLabels.singular}`
                  : `${resultCount} ${resultLabels.plural}`}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
