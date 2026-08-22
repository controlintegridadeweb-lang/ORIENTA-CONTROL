"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pagination } from "@/shared/ui/components/pagination";
import { usePagination } from "@/shared/hooks/use-pagination";
import { formSurface } from "@/shared/layout/form-surface";

type OrganizationMultiSelectOption = {
  id: string;
  label: string;
  locked?: boolean;
  lockedLabel?: string;
};

type Props = {
  options: OrganizationMultiSelectOption[];
  selectedIds: ReadonlySet<string>;
  onChange: (selectedIds: Set<string>) => void;
  disabled?: boolean;
  pageSize?: number;
  ariaLabel?: string;
  searchInputId?: string;
  ariaDescribedBy?: string;
  invalid?: boolean;
  /** Ações do rodapé (ex.: Salvar seleção), ao lado da paginação. */
  footerActions?: ReactNode;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Seleção reutilizável para listas extensas de organizações. */
export function OrganizationMultiSelect({
  options,
  selectedIds,
  onChange,
  disabled = false,
  pageSize = 10,
  ariaLabel = "Selecionar organizações",
  searchInputId,
  ariaDescribedBy,
  invalid = false,
  footerActions,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [options],
  );
  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return sorted.filter((option) => {
      if (selectedOnly && !selectedIds.has(option.id)) return false;
      return !term || normalize(option.label).includes(term);
    });
  }, [search, selectedIds, selectedOnly, sorted]);
  const pagination = usePagination({
    totalItems: filtered.length,
    pageSize,
    resetKey: `${search}|${selectedOnly}`,
  });
  const lockedIds = useMemo(
    () => new Set(options.filter((option) => option.locked).map((option) => option.id)),
    [options],
  );
  const allSelected = options.length > 0 && options.every((option) => selectedIds.has(option.id));
  const showPagination = pagination.totalPages > 1;
  const showFooter = showPagination || Boolean(footerActions);

  function toggle(id: string) {
    if (lockedIds.has(id)) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(options.map((option) => option.id)));
  }

  function clear() {
    onChange(new Set(lockedIds));
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="space-y-3 border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className={`${formSurface.fieldGroup} min-w-0 flex-1`}>
            <span className={formSurface.label}>Buscar organização</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id={searchInputId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite parte do nome…"
                className={`${formSurface.input} pl-9 pr-9`}
                aria-invalid={invalid}
                aria-describedby={ariaDescribedBy}
                disabled={disabled}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </span>
          </label>

          <label className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(event) => setSelectedOnly(event.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
            />
            Mostrar somente selecionadas
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700" aria-live="polite">
            <strong className="tabular-nums text-slate-900">{selectedIds.size}</strong> de{" "}
            <strong className="tabular-nums text-slate-900">{options.length}</strong>{" "}
            {options.length === 1 ? "organização selecionada" : "organizações selecionadas"}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={selectAll}
              disabled={disabled || allSelected || options.length === 0}
              className="font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Selecionar todas, inclusive de outras páginas
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={disabled || selectedIds.size === lockedIds.size}
              className="font-medium text-slate-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-600">
          {selectedOnly
            ? "Nenhuma organização selecionada corresponde à busca."
            : "Nenhuma organização corresponde à busca."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pagination.pageItems(filtered).map((option) => (
            <li key={option.id}>
              <label
                className={`flex min-h-11 items-start gap-3 px-4 py-2.5 text-sm text-slate-800 ${
                  option.locked
                    ? "cursor-not-allowed bg-slate-50/70"
                    : "cursor-pointer hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(option.id)}
                  onChange={() => toggle(option.id)}
                  disabled={disabled || option.locked}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                />
                <span className="min-w-0 flex-1">{option.label}</span>
                {option.locked ? (
                  <span className={`${formSurface.badge.base} ${formSurface.badge.muted}`}>
                    {option.lockedLabel ?? "Seleção obrigatória"}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}

      {showFooter ? (
        <footer
          className={
            showPagination
              ? "flex flex-col gap-4 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              : "flex flex-col gap-4 border-t border-slate-200 p-4 sm:flex-row sm:justify-end"
          }
        >
          {showPagination ? (
            <Pagination
              pagination={pagination}
              resultLabel={{ singular: "organização", plural: "organizações" }}
              variant="bare"
              alwaysShow
            />
          ) : null}
          {footerActions ? (
            <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">{footerActions}</div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
