"use client";

import type { PaginationState } from "@/shared/hooks/use-pagination";
import { layout, typography } from "@/shared/layout/design-system";
import { RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL } from "@/shared/navigation/respondent-portfolio-paths";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { Pagination } from "@/shared/ui/components/pagination";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type {
  RespondentRecommendationItem,
  RespondentRecommendationSummary,
} from "@/features/improvement-management/recommendations/respondent-presentation";
import { RespondentRecommendationEmptyState } from "./respondent-recommendation-empty-state";
import {
  RespondentRecommendationFilters,
  type RespondentRecommendationFilterValue,
} from "./respondent-recommendation-filters";
import {
  resolveRespondentRecommendationEmptyVariant,
  respondentRecommendationHasActiveFilters,
} from "./respondent-recommendation-list-state";
import { RespondentRecommendationList } from "./respondent-recommendation-list";
import { RespondentSectionActionPlanList } from "./respondent-section-action-plan-list";
import {
  RespondentRecommendationSummaryCards,
  type SummaryCardKey,
} from "./respondent-recommendation-summary-cards";

type Props = {
  actionPlanView: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loading: boolean;
  rows: RespondentRecommendationItem[];
  summary: RespondentRecommendationSummary;
  activeSummaryKey: SummaryCardKey | null;
  onSummarySelect: (key: SummaryCardKey) => void;
  filter: RespondentRecommendationFilterValue;
  onFilterChange: (next: RespondentRecommendationFilterValue) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onClear: () => void;
  forms: { id: string; name: string }[];
  axes: { value: string; label: string }[];
  actionPlanSectionCount: number;
  filteredRows: RespondentRecommendationItem[];
  selectedCycleLabel: string | null;
  totalForView: number;
  pagedRows: RespondentRecommendationItem[];
  listPath: string;
  pagination: PaginationState;
};

/** Corpo da página: indicadores, filtros e a lista da visão atual. */
export function RespondentRecommendationsPanels({
  actionPlanView,
  error,
  refetch,
  loading,
  rows,
  summary,
  activeSummaryKey,
  onSummarySelect,
  filter,
  onFilterChange,
  onSearchFocus,
  onSearchBlur,
  onClear,
  forms,
  axes,
  actionPlanSectionCount,
  filteredRows,
  selectedCycleLabel,
  totalForView,
  pagedRows,
  listPath,
  pagination,
}: Props) {
  const hasActiveFilters = respondentRecommendationHasActiveFilters(actionPlanView, filter);
  const emptyVariant = resolveRespondentRecommendationEmptyVariant({
    actionPlanView,
    rows,
    filteredCount: filteredRows.length,
    hasActiveFilters,
  });
  const visibleCount = actionPlanView ? actionPlanSectionCount : filteredRows.length;
  const listTitle = actionPlanView
    ? RESPONDENT_ACTION_PLAN_LIST_TAB_LABEL
    : "Recomendações";
  const listDescription = actionPlanView
    ? "A estrutura parte do diagnóstico e avança por eixo, seção, plano da seção e ações, mantendo as recomendações como referência para identificar a origem de cada ação."
    : "Apresentadas na mesma sequência do diagnóstico, por eixo, seção e recomendação.";

  return (
    <section className={`${layout.panelStack} pt-4`}>
      {error ? (
        <AsyncErrorState
          title={
            actionPlanView
              ? "Não foi possível carregar o plano de integridade e compliance"
              : "Não foi possível carregar as recomendações"
          }
          message={error}
          onRetry={refetch}
          retrying={loading}
          compact={rows.length > 0}
        />
      ) : null}

      {!actionPlanView ? (
        <PanelSection
          title="Indicadores"
          description="Selecione um cartão para filtrar a lista."
          variant="plain"
        >
          <RespondentRecommendationSummaryCards
            summary={summary}
            loading={loading && rows.length === 0}
            activeKey={activeSummaryKey}
            onSelect={onSummarySelect}
          />
        </PanelSection>
      ) : null}

      <PanelSection
        title="Filtros"
        description="Refine a lista por situação, formulário, eixo ou diagnóstico."
        variant="plain"
      >
        <RespondentRecommendationFilters
          value={filter}
          onChange={onFilterChange}
          onSearchFocus={onSearchFocus}
          onSearchBlur={onSearchBlur}
          onClear={onClear}
          forms={forms}
          axes={axes}
          resultCount={visibleCount}
          resultLabels={
            actionPlanView
              ? { singular: "seção com plano", plural: "seções com plano" }
              : undefined
          }
          lockedPlanScope={actionPlanView ? "with" : undefined}
          cycleLabel={selectedCycleLabel}
        />
      </PanelSection>

      <PanelSection
        title={listTitle}
        description={listDescription}
        variant="plain"
        contentClassName="space-y-4"
      >
        {visibleCount !== totalForView ? (
          <p className={typography.meta}>
            Exibindo{" "}
            <span className="font-medium tabular-nums text-slate-700">{visibleCount}</span>{" "}
            de <span className="tabular-nums text-slate-600">{totalForView}</span>{" "}
            {actionPlanView ? "seções com plano" : "recomendações"} com os filtros atuais
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="space-y-4" aria-hidden>
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-44 animate-pulse rounded-xl border border-slate-100 bg-slate-50/80"
              />
            ))}
          </div>
        ) : emptyVariant ? (
          <RespondentRecommendationEmptyState
            variant={emptyVariant}
            onClearFilters={hasActiveFilters ? onClear : undefined}
          />
        ) : (
          actionPlanView ? (
            <RespondentSectionActionPlanList
              items={rows}
              matchingItems={filteredRows}
              returnPath={listPath}
            />
          ) : (
            <>
              <RespondentRecommendationList items={pagedRows} returnPath={listPath} />
              <Pagination
                pagination={pagination}
                variant="panel"
                resultLabel={{ singular: "recomendação", plural: "recomendações" }}
                aria-label="Paginação de recomendações"
              />
            </>
          )
        )}
      </PanelSection>
    </section>
  );
}
