import Link from "next/link";
import { Search, X } from "lucide-react";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import type { CycleState } from "@/shared/domain/types";
import {
  STATE_LABEL,
  STATE_ORDER,
  type CollectionFilter,
  type DueFilter,
} from "@/features/cycles/dashboard-model";
import type {
  CycleDashboardFormScope,
  CycleDashboardOrganizationOption,
  CycleDashboardPeriodOption,
  CycleDashboardPeriodScope,
} from "./cycle-dashboard-contracts";

type Props = {
  formScope: CycleDashboardFormScope | null;
  periodScope: CycleDashboardPeriodScope | null;
  periodOptions: CycleDashboardPeriodOption[];
  periodBaseDeadlineAt: string | null;
  forms: CycleDashboardFormScope[];
  organizations: CycleDashboardOrganizationOption[];
  formId: string;
  search: string;
  organizationId: string;
  state: CycleState | "";
  dueFilter: DueFilter;
  collectionFilter: CollectionFilter;
  requireFormSelection: boolean;
  hasSecondaryFilters: boolean;
  currentListPath: string;
  onFormChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onOrganizationChange: (value: string) => void;
  onStateChange: (value: CycleState | "") => void;
  onDueFilterChange: (value: DueFilter) => void;
  onCollectionFilterChange: (value: CollectionFilter) => void;
  onPeriodChange: (periodId: string) => void;
  onClear: () => void;
};

const fieldLabel = formSurface.label;
const fieldInput = formSurface.input;
const fieldSelect = formSurface.inputSelect;

export function CycleDashboardFilters(props: Props) {
  const {
    formScope,
    periodScope,
    periodOptions,
    periodBaseDeadlineAt,
    forms,
    organizations,
    formId,
    search,
    organizationId,
    state,
    dueFilter,
    collectionFilter,
    requireFormSelection,
    hasSecondaryFilters,
    currentListPath,
  } = props;

  return (
    <PanelSection
      title="Filtros"
      description="Selecione o formulário para ver a situação de cada órgão. Os demais filtros refinam essa visão."
      variant="plain"
    >
      <div className={`overflow-hidden ${formSurface.dashboardPanel}`}>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <label className={`${formSurface.fieldGroup} block min-w-0 sm:col-span-2 xl:col-span-1`}>
              <span className={fieldLabel}>Formulário</span>
              {formScope ? (
                <div className="space-y-2">
                  <div className={formSurface.readOnlyField}>{formScope.name}</div>
                  <Link
                    href={`/admin/ciclos/gestao?formId=${encodeURIComponent(formScope.id)}${
                      periodScope
                        ? `&periodId=${encodeURIComponent(periodScope.id)}`
                        : periodOptions[0]
                          ? `&periodId=${encodeURIComponent(periodOptions[0].id)}`
                          : ""
                    }&returnTo=${encodeURIComponent(currentListPath)}`}
                    className={formSurface.secondaryButtonSm}
                  >
                    Ver detalhes do formulário
                  </Link>
                </div>
              ) : (
                <select
                  value={formId}
                  onChange={(event) => props.onFormChange(event.target.value)}
                  className={fieldSelect}
                  required
                >
                  <option value="">Selecione um formulário</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Período</span>
              <select
                value={periodScope?.id ?? ""}
                onChange={(event) => props.onPeriodChange(event.target.value)}
                className={fieldSelect}
                disabled={requireFormSelection || periodOptions.length === 0}
              >
                <option value="">
                  {periodOptions.length > 1 ? "Mais recente de cada órgão" : "Todos"}
                </option>
                {periodOptions.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label}
                  </option>
                ))}
              </select>
              {periodScope && periodBaseDeadlineAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Prazo-base do período:{" "}
                  {new Date(periodBaseDeadlineAt).toLocaleString("pt-BR", {
                    timeZone: "America/Fortaleza",
                  })}
                </p>
              ) : null}
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Busca</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => props.onSearchChange(event.target.value)}
                  placeholder="Órgão ou sigla"
                  className={`${fieldInput} py-2 pl-9`}
                  disabled={requireFormSelection}
                />
              </div>
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Organização</span>
              <select
                value={organizationId}
                onChange={(event) => props.onOrganizationChange(event.target.value)}
                className={fieldSelect}
                disabled={requireFormSelection}
              >
                <option value="">Todas</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Situação</span>
              <select
                value={state}
                onChange={(event) =>
                  props.onStateChange(event.target.value as CycleState | "")
                }
                className={fieldSelect}
                disabled={requireFormSelection}
              >
                <option value="">Todas</option>
                {STATE_ORDER.map((entry) => (
                  <option key={entry} value={entry}>
                    {STATE_LABEL[entry]}
                  </option>
                ))}
              </select>
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Prazo</span>
              <select
                value={dueFilter}
                onChange={(event) =>
                  props.onDueFilterChange(event.target.value as DueFilter)
                }
                className={fieldSelect}
                disabled={requireFormSelection}
              >
                <option value="all">Todos</option>
                <option value="in_response">Com ação do respondente</option>
                <option value="overdue">Com prazo vencido</option>
              </select>
            </label>

            <label className={`${formSurface.fieldGroup} block min-w-0`}>
              <span className={fieldLabel}>Coleta</span>
              <select
                value={collectionFilter}
                onChange={(event) =>
                  props.onCollectionFilterChange(
                    event.target.value as CollectionFilter,
                  )
                }
                className={fieldSelect}
                disabled={requireFormSelection}
              >
                <option value="all">Todas</option>
                <option value="active">Ativa</option>
                <option value="suspended">Suspensa</option>
              </select>
            </label>
          </div>

          {hasSecondaryFilters && !requireFormSelection ? (
            <div className="flex border-t border-slate-100 pt-3 sm:justify-end">
              <button
                type="button"
                onClick={props.onClear}
                className={`${formSurface.secondaryButtonSm} w-full justify-center gap-1.5 text-xs sm:w-auto`}
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </PanelSection>
  );
}
