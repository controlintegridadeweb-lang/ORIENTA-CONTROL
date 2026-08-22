"use client";

import type { LibraryItemStatus } from "@/features/library/types";
import { LIBRARY_ITEM_STATUSES } from "@/features/library/types";
import { LIBRARY_STATUS_LABEL } from "@/features/library/config";
import { formSurface } from "@/shared/layout/form-surface";

export type LibraryFiltersState = {
  search: string;
  status: LibraryItemStatus | "all";
  tag: string;
};

type Props = {
  state: LibraryFiltersState;
  availableTags: string[];
  onChange: (next: LibraryFiltersState) => void;
};

export function LibraryFilters({ state, availableTags, onChange }: Props) {
  const hasFilters = Boolean(state.search) || state.status !== "all" || Boolean(state.tag);

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4 sm:px-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] lg:items-end lg:gap-4">
        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Buscar</span>
          <input
            type="search"
            value={state.search}
            placeholder="Código, nome ou título…"
            onChange={(event) => onChange({ ...state, search: event.target.value })}
            className={formSurface.input}
          />
        </label>

        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Situação</span>
          <select
            value={state.status}
            onChange={(event) =>
              onChange({
                ...state,
                status: event.target.value as LibraryFiltersState["status"],
              })
            }
            className={formSurface.inputSelect}
          >
            <option value="all">Todos</option>
            {LIBRARY_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LIBRARY_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>

        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Tag</span>
          <select
            value={state.tag}
            onChange={(event) => onChange({ ...state, tag: event.target.value })}
            className={formSurface.inputSelect}
          >
            <option value="">Todas</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        {hasFilters ? (
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => onChange({ search: "", status: "all", tag: "" })}
              className={`${formSurface.secondaryButtonSm} w-full lg:w-auto`}
            >
              Limpar filtros
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
