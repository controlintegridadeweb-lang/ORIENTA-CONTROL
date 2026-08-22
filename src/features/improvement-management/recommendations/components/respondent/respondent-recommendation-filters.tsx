"use client";

import { formSurface } from "@/shared/layout/form-surface";
import { STATUS_META } from "@/features/improvement-management/recommendations/respondent-presentation";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";
import { ResponsiveFilterPanel } from "@/shared/ui/components/responsive-filter-panel";

export type RespondentRecommendationFilterValue = {
  search: string;
  status: RecommendationStatus | "";
  cycleId: string;
  formId: string;
  axisId: string;
  withPlan: "all" | "with" | "without";
  pendingOnly: boolean;
};

type FormOption = { id: string; name: string };
type AxisOption = { value: string; label: string };

type Props = {
  value: RespondentRecommendationFilterValue;
  onChange: (next: RespondentRecommendationFilterValue) => void;
  onClear: () => void;
  forms: FormOption[];
  axes: AxisOption[];
  resultCount?: number;
  resultLabels?: { singular: string; plural: string };
  /** Mantém o escopo de execução em itens que já possuem plano. */
  lockedPlanScope?: "with";
  cycleLabel?: string | null;
};

const STATUS_OPTIONS: RecommendationStatus[] = [
  "generated",
  "in_action_plan",
  "adjustment_requested",
  "exception_requested",
  "awaiting_approval",
  "completed",
  "dismissed",
];

function hasActive(
  value: RespondentRecommendationFilterValue,
  lockedPlanScope?: "with",
): boolean {
  return Boolean(
    value.search.trim() ||
      value.status ||
      value.cycleId ||
      value.formId ||
      value.axisId ||
      value.withPlan !== (lockedPlanScope ?? "all") ||
      value.pendingOnly,
  );
}

export function RespondentRecommendationFilters({
  value,
  onChange,
  onClear,
  forms,
  axes,
  resultCount,
  resultLabels = { singular: "recomendação", plural: "recomendações" },
  lockedPlanScope,
  cycleLabel,
}: Props) {
  function patch(next: Partial<RespondentRecommendationFilterValue>) {
    onChange({ ...value, ...next });
  }

  const scope = value.cycleId ? (
    <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <strong>Diagnóstico selecionado:</strong> {cycleLabel || "escopo informado no link"}
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
      ariaLabel="Filtros de recomendações"
      searchValue={value.search}
      onSearchChange={(search) => patch({ search })}
      searchPlaceholder="Buscar por texto, eixo, seção ou formulário…"
      active={hasActive(value, lockedPlanScope)}
      onClear={onClear}
      resultCount={resultCount}
      resultLabels={resultLabels}
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      scope={scope}
      footer={
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-slate-200 text-brand focus:ring-brand/30"
            checked={value.pendingOnly}
            onChange={(event) => patch({ pendingOnly: event.target.checked })}
          />
          Somente pendentes de ação
        </label>
      }
    >
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Situação</span>
        <select
          className={formSurface.inputSelect}
          value={value.status}
          onChange={(event) => patch({ status: event.target.value as RecommendationStatus | "" })}
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_META[status].label}
            </option>
          ))}
        </select>
      </label>

      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>Formulário</span>
        <select
          className={formSurface.inputSelect}
          value={value.formId}
          onChange={(event) => patch({ formId: event.target.value, cycleId: "" })}
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
        <span className={formSurface.label}>Eixo</span>
        <select
          className={formSurface.inputSelect}
          value={value.axisId}
          onChange={(event) => patch({ axisId: event.target.value })}
        >
          <option value="">Todos</option>
          {axes.map((axis) => (
            <option key={axis.value} value={axis.value}>
              {axis.label}
            </option>
          ))}
        </select>
      </label>

      {!lockedPlanScope ? (
        <label className={formSurface.fieldGroup}>
          <span className={formSurface.label}>Plano de ação</span>
          <select
            className={formSurface.inputSelect}
            value={value.withPlan}
            onChange={(event) =>
              patch({ withPlan: event.target.value as "all" | "with" | "without" })
            }
          >
            <option value="all">Todas</option>
            <option value="with">Somente vinculadas</option>
            <option value="without">Somente sem plano</option>
          </select>
        </label>
      ) : null}
    </ResponsiveFilterPanel>
  );
}
