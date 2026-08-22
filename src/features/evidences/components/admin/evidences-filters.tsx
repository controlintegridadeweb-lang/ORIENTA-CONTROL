"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { EvidenceFilterOptions } from "@/features/evidences/types";
import type { ValidationStatus } from "@/features/evidences/schemas";
import { formSurface } from "@/shared/layout/form-surface";
import { workflowStatusFilterOptions } from "@/shared/ui/status-registry";
import { STATUS_LABELS } from "./status-badge";
import {
  asFortalezaIso,
  PLATFORM_TIME_ZONE_LABEL,
  toFortalezaDateTimeInput,
} from "@/shared/datetime/fortaleza-date-time";

/** Situações da fila de validação (exclui pré-envio e não exigida). */
const STATUS_OPTIONS = workflowStatusFilterOptions("evidence_validation", {
  exclude: ["pending", "not_required"],
});

export type EvidencesFilterState = {
  /** Recortes canônicos vindos de um diagnóstico ou deep link. */
  cycleId: string;
  questionId: string;
  evidenceId: string;
  formId: string;
  organizationId: string;
  status: "" | ValidationStatus;
  search: string;
  from: string;
  to: string;
};

type Props = {
  options: EvidenceFilterOptions | null;
  value: EvidencesFilterState;
  onChange: (next: EvidencesFilterState) => void;
  onClear: () => void;
  loading?: boolean;
};

export function EvidencesFilters({ options, value, onChange, onClear, loading }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (value.cycleId) {
      chips.push({
        key: "cycle",
        label: "Diagnóstico selecionado",
        onRemove: () => onChange({ ...value, cycleId: "", questionId: "", evidenceId: "" }),
      });
    }
    if (value.questionId) {
      chips.push({
        key: "question",
        label: "Pergunta selecionada",
        onRemove: () => onChange({ ...value, questionId: "", evidenceId: "" }),
      });
    }
    if (value.formId) {
      const f = options?.forms.find((x) => x.id === value.formId);
      chips.push({
        key: "form",
        label: f ? `Formulário: ${f.name} (v${f.version})` : "Formulário",
        onRemove: () => onChange({ ...value, formId: "", cycleId: "", questionId: "", evidenceId: "" }),
      });
    }
    if (value.organizationId) {
      const o = options?.organizations.find((x) => x.id === value.organizationId);
      chips.push({
        key: "org",
        label: o ? `Organização: ${o.name}` : "Organização",
        onRemove: () => onChange({ ...value, organizationId: "", formId: "", cycleId: "", questionId: "", evidenceId: "" }),
      });
    }
    if (value.status) {
      chips.push({
        key: "status",
        label: `Situação: ${STATUS_LABELS[value.status]}`,
        onRemove: () => onChange({ ...value, status: "" }),
      });
    }
    if (value.search.trim()) {
      chips.push({
        key: "search",
        label: `Busca: "${value.search.trim()}"`,
        onRemove: () => onChange({ ...value, search: "" }),
      });
    }
    if (value.from) {
      chips.push({
        key: "from",
        label: `De: ${value.from.slice(0, 10)}`,
        onRemove: () => onChange({ ...value, from: "" }),
      });
    }
    if (value.to) {
      chips.push({
        key: "to",
        label: `Até: ${value.to.slice(0, 10)}`,
        onRemove: () => onChange({ ...value, to: "" }),
      });
    }
    return chips;
  }, [options, value, onChange]);

  const grid = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      <label className={`${formSurface.fieldGroup} sm:col-span-2 xl:col-span-1 2xl:col-span-1`}>
        <span className={formSurface.label}>Busca</span>
        <input
          type="search"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Título, pergunta, organização…"
          className={formSurface.input}
        />
      </label>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Formulário</span>
        <select
          value={value.formId}
          onChange={(e) => onChange({ ...value, formId: e.target.value })}
          className={`${formSurface.inputSelect} font-normal normal-case tracking-normal`}
        >
          <option value="">Todos</option>
          {options?.forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} (v{f.version})
            </option>
          ))}
        </select>
      </label>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Organização</span>
        <select
          value={value.organizationId}
          onChange={(e) => onChange({ ...value, organizationId: e.target.value })}
          disabled={(options?.organizations.length ?? 0) <= 1}
          className={`${formSurface.inputSelect} font-normal normal-case tracking-normal disabled:cursor-not-allowed`}
        >
          <option value="">Todas</option>
          {options?.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Situação</span>
        <select
          value={value.status}
          onChange={(e) =>
            onChange({ ...value, status: e.target.value as "" | ValidationStatus })
          }
          className={`${formSurface.inputSelect} font-normal normal-case tracking-normal`}
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>De (data)</span>
        <input
          type="datetime-local"
          value={toDateTimeInput(value.from)}
          onChange={(e) =>
            onChange({
              ...value,
              from: fromDateTimeInput(e.target.value),
            })
          }
          className={formSurface.input}
        />
      </label>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Até (data)</span>
        <input
          type="datetime-local"
          value={toDateTimeInput(value.to)}
          onChange={(e) =>
            onChange({
              ...value,
              to: fromDateTimeInput(e.target.value),
            })
          }
          className={formSurface.input}
        />
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
        Datas no {PLATFORM_TIME_ZONE_LABEL}.
      </p>
      <div className="flex min-h-11 w-full flex-col justify-end sm:col-span-2 sm:min-h-0 lg:col-span-1 lg:w-auto">
        <button
          type="button"
          onClick={onClear}
          disabled={activeChips.length === 0}
          className={`${formSurface.secondaryButtonSm} w-full min-h-10 disabled:opacity-50 sm:w-auto sm:min-h-9`}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpar
        </button>
      </div>
    </div>
  );

  return (
    <div className={formSurface.card}>
      <div className="flex items-center justify-end border-b border-slate-100 px-4 py-2 md:hidden sm:px-5">
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${formSurface.ghostButton}`}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "Ocultar campos" : "Mostrar campos"}
          <ChevronDown
            className={`h-4 w-4 transition ${mobileOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      <div
        className={
          mobileOpen
            ? `${formSurface.body} border-t border-slate-100 md:border-t-0`
            : `hidden md:block ${formSurface.body}`
        }
      >
        {grid}
        {loading ? (
          <p className="text-xs text-slate-500">Atualizando lista...</p>
        ) : null}
      </div>
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-5">
          <span className="text-micro font-semibold uppercase tracking-wider text-slate-500">
            Ativos
          </span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className={`${formSurface.chip.base} ${formSurface.chip.neutral} pr-1`}
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toDateTimeInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toFortalezaDateTimeInput(date);
}

function fromDateTimeInput(value: string): string {
  return value ? (asFortalezaIso(value) ?? "") : "";
}
