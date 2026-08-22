"use client";

import { useMemo } from "react";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";
import type { ValidationStatus } from "@/features/evidences/schemas";
import { formSurface } from "@/shared/layout/form-surface";
import { ResponsiveFilterPanel } from "@/shared/ui/components/responsive-filter-panel";

export type RespondentFilterValue = {
  search: string;
  cycleId: string;
  formId: string;
  status: "" | ValidationStatus;
  axisName: string;
  sectionName: string;
  pendingOnly: boolean;
};

export type FormOption = { id: string; name: string };
export type CycleOption = { id: string; formId: string; formName: string; periodLabel: string };
export type HierarchyOption = { formId: string; axisName: string; sectionName: string };

type Props = {
  value: RespondentFilterValue;
  onChange: (next: RespondentFilterValue) => void;
  onClear: () => void;
  forms: FormOption[];
  cycles: CycleOption[];
  hierarchy: HierarchyOption[];
  resultCount?: number;
};

const STATUS_OPTIONS: ValidationStatus[] = [
  "pending",
  "submitted",
  "approved",
  "invalidated",
  "adjustment_requested",
];

function hasActive(value: RespondentFilterValue): boolean {
  return Boolean(
    value.search.trim() ||
      value.cycleId ||
      value.formId ||
      value.status ||
      value.axisName ||
      value.sectionName ||
      value.pendingOnly,
  );
}

export function RespondentEvidenceFilters({
  value,
  onChange,
  onClear,
  forms,
  cycles,
  hierarchy,
  resultCount,
}: Props) {
  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === value.cycleId) ?? null,
    [cycles, value.cycleId],
  );

  const scopedHierarchy = useMemo(() => {
    const formId = value.formId || selectedCycle?.formId || "";
    if (!formId) return hierarchy;
    return hierarchy.filter((row) => row.formId === formId);
  }, [hierarchy, selectedCycle?.formId, value.formId]);

  const axisOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of scopedHierarchy) {
      if (row.axisName) names.add(row.axisName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [scopedHierarchy]);

  const sectionOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of scopedHierarchy) {
      if (value.axisName && row.axisName !== value.axisName) continue;
      if (row.sectionName) names.add(row.sectionName);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [scopedHierarchy, value.axisName]);

  function patch(next: Partial<RespondentFilterValue>) {
    onChange({ ...value, ...next });
  }

  const scope = value.cycleId ? (
    <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <strong>Diagnóstico selecionado:</strong>{" "}
        {selectedCycle
          ? `${selectedCycle.formName} · ${selectedCycle.periodLabel}`
          : "escopo informado no link"}
      </span>
      <button
        type="button"
        onClick={() => patch({ cycleId: "" })}
        className={`${formSurface.ghostButton} self-start text-sky-800 hover:bg-sky-100 sm:self-auto`}
      >
        Remover escopo
      </button>
    </div>
  ) : null;

  return (
    <ResponsiveFilterPanel
      ariaLabel="Filtros de evidências"
      searchValue={value.search}
      onSearchChange={(search) => patch({ search })}
      searchPlaceholder="Título, pergunta, formulário…"
      active={hasActive(value)}
      onClear={onClear}
      resultCount={resultCount}
      resultLabels={{ singular: "evidência", plural: "evidências" }}
      scope={scope}
      footer={
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={value.pendingOnly}
            onChange={(event) => patch({ pendingOnly: event.target.checked })}
            className="h-4 w-4 rounded border border-slate-200 text-brand focus:ring-brand/30"
          />
          Somente pendências
        </label>
      }
    >
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Formulário</span>
        <select
          value={value.formId}
          onChange={(event) =>
            patch({
              formId: event.target.value,
              cycleId: "",
              axisName: "",
              sectionName: "",
            })
          }
          className={formSurface.inputSelect}
        >
          <option value="">Todos</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.name}
            </option>
          ))}
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Situação</span>
        <select
          value={value.status}
          onChange={(event) => patch({ status: event.target.value as "" | ValidationStatus })}
          className={formSurface.inputSelect}
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {EVIDENCE_VALIDATION_REGISTRY[status].label}
            </option>
          ))}
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Eixo</span>
        <select
          value={value.axisName}
          onChange={(event) =>
            patch({
              axisName: event.target.value,
              sectionName: "",
            })
          }
          className={formSurface.inputSelect}
        >
          <option value="">Todos</option>
          {axisOptions.map((axisName) => (
            <option key={axisName} value={axisName}>
              {axisName}
            </option>
          ))}
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Seção</span>
        <select
          value={value.sectionName}
          onChange={(event) => patch({ sectionName: event.target.value })}
          className={formSurface.inputSelect}
        >
          <option value="">Todas</option>
          {sectionOptions.map((sectionName) => (
            <option key={sectionName} value={sectionName}>
              {sectionName}
            </option>
          ))}
        </select>
      </label>
    </ResponsiveFilterPanel>
  );
}
