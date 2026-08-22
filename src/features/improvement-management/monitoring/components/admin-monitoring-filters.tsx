"use client";

import { ChevronDown, Filter, Search, X } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

export type AdminMonitoringBaseFilters = {
  search: string;
  organizationId: string;
  formId: string;
  cycleId: string;
  from: string;
  to: string;
};

type AdminMonitoringFilterOption = { id: string; label: string };
type AdminMonitoringSelectField<TState> = {
  key: keyof TState;
  label: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
};

type Props<TState extends AdminMonitoringBaseFilters> = {
  value: TState;
  initialValue: TState;
  organizations: AdminMonitoringFilterOption[];
  forms: AdminMonitoringFilterOption[];
  selectFields: Array<AdminMonitoringSelectField<TState>>;
  onChange: (next: TState) => void;
  searchPlaceholder: string;
  dateFromLabel: string;
  gridClassName: string;
};

const fieldLabel = formSurface.label;
const fieldInput = formSurface.input;
const fieldSelect = formSurface.inputSelect;

export function AdminMonitoringFilters<TState extends AdminMonitoringBaseFilters>({
  value,
  initialValue,
  organizations,
  forms,
  selectFields,
  onChange,
  searchPlaceholder,
  dateFromLabel,
  gridClassName,
}: Props<TState>) {
  function set<K extends keyof TState>(key: K, nextValue: TState[K]) {
    if (key === "organizationId") {
      onChange({ ...value, organizationId: String(nextValue), formId: "", cycleId: "" });
      return;
    }
    if (key === "formId") {
      onChange({ ...value, formId: String(nextValue), cycleId: "" });
      return;
    }
    onChange({ ...value, [key]: nextValue });
  }

  const organizationOnSurface = organizations.length > 1;
  const isDirty = Object.keys(initialValue).some(
    (key) => value[key as keyof TState] !== initialValue[key as keyof TState],
  );
  const panelCount = [
    !organizationOnSurface && value.organizationId,
    value.from,
    value.to,
  ].filter(Boolean).length;

  return (
    <div className={`overflow-hidden ${formSurface.dashboardPanel}`}>
      <div className="space-y-3 p-4 sm:p-5">
        <div className={gridClassName}>
          <label className={`${formSurface.fieldGroup} block min-w-0`}>
            <span className={fieldLabel}>Busca</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={value.search}
                onChange={(event) => set("search", event.target.value as TState["search"])}
                placeholder={searchPlaceholder}
                className={`${fieldInput} py-2 pl-9`}
              />
            </div>
          </label>

          {organizationOnSurface ? (
            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Organização</span>
              <select
                value={value.organizationId}
                onChange={(event) => set("organizationId", event.target.value as TState["organizationId"])}
                className={fieldSelect}
              >
                <option value="">Todas</option>
                {organizations.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={`${formSurface.fieldGroup} block min-w-0`}>
            <span className={fieldLabel}>Formulário</span>
            <select
              value={value.formId}
              onChange={(event) => set("formId", event.target.value as TState["formId"])}
              className={fieldSelect}
            >
              <option value="">Todos</option>
              {forms.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          {selectFields.map((field) => (
            <label key={String(field.key)} className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>{field.label}</span>
              <select
                value={String(value[field.key] ?? "")}
                onChange={(event) => set(field.key, event.target.value as TState[keyof TState])}
                className={fieldSelect}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-700 outline-none marker:hidden hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <Filter className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1">
              Período (opcional)
              {panelCount > 0 ? (
                <span className="ml-1.5 tabular-nums font-normal text-slate-500">({panelCount})</span>
              ) : null}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
          </summary>

          <div className="mt-2 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/30 p-3 sm:grid-cols-2 sm:p-4">
            {!organizationOnSurface ? (
              <label className={formSurface.fieldGroup}>
                <span className={fieldLabel}>Organização</span>
                <select
                  value={value.organizationId}
                  onChange={(event) => set("organizationId", event.target.value as TState["organizationId"])}
                  disabled={organizations.length <= 1}
                  className={`${fieldSelect} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <option value="">Todas</option>
                  {organizations.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className={formSurface.fieldGroup}>
              <span className={fieldLabel}>{dateFromLabel}</span>
              <input
                type="date"
                value={value.from}
                onChange={(event) => set("from", event.target.value as TState["from"])}
                className={fieldInput}
              />
            </label>
            <label className={formSurface.fieldGroup}>
              <span className={fieldLabel}>até</span>
              <input
                type="date"
                value={value.to}
                onChange={(event) => set("to", event.target.value as TState["to"])}
                className={fieldInput}
              />
            </label>
          </div>
        </details>

        {isDirty ? (
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onChange({ ...initialValue })}
              className={`${formSurface.secondaryButtonSm} gap-1.5 text-xs`}
            >
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Limpar filtros
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
