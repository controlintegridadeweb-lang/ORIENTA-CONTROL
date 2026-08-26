"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { layout, typography } from "@/shared/layout/design-system";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { usePagination } from "@/shared/hooks/use-pagination";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import type { RespondentRecommendationItem } from "@/features/improvement-management/recommendations/respondent-presentation";
import { downloadRespondentPortfolioExport } from "@/features/improvement-management/recommendations/export/portfolio-export-client";
import type { RecommendationPortfolioExportFormat } from "@/features/improvement-management/recommendations/export/portfolio-export-types";
import { downloadRespondentActionPlanExport } from "@/features/improvement-management/action-plans/export/action-plan-export-client";
import { Pagination } from "@/shared/ui/components/pagination";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { useRespondentRecommendations } from "./hooks/use-respondent-recommendations";
import { RespondentRecommendationList } from "./respondent-recommendation-list";
import { RespondentSectionActionPlanList } from "./respondent-section-action-plan-list";
import {
  RespondentRecommendationEmptyState,
  type EmptyVariant,
} from "./respondent-recommendation-empty-state";
import {
  RespondentRecommendationFilters,
  type RespondentRecommendationFilterValue,
} from "./respondent-recommendation-filters";
import {
  RespondentRecommendationSummaryCards,
  type SummaryCardKey,
} from "./respondent-recommendation-summary-cards";
import { RespondentRecommendationsHero } from "./respondent-recommendations-hero";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import {
  respondentActionWorkspacePath,
} from "@/shared/navigation/respondent-portfolio-paths";
import {
  respondentRecommendationPage,
  respondentRecommendationListPath,
  respondentRecommendationView,
  type RespondentRecommendationListFilter,
  type RespondentRecommendationListView,
} from "@/shared/navigation/respondent-navigation-context";

import { underlineTabLinkClass } from "@/shared/ui/components/underline-tabs";
import { isInvalidUuidParam, parseUuidParam, uuidParamOrEmpty } from "@/shared/validation/uuid";
import { buildSectionActionPlanHierarchy, sectionActionPlanSourcesFromListItems } from "@/features/improvement-management/action-plans/section-action-plan-model";

const ANALYSIS_INITIAL_FILTER: RespondentRecommendationFilterValue = {
  search: "",
  status: "",
  cycleId: "",
  formId: "",
  axisId: "",
  withPlan: "all",
  pendingOnly: false,
};

const ACTION_PLAN_INITIAL_FILTER: RespondentRecommendationFilterValue = {
  ...ANALYSIS_INITIAL_FILTER,
  withPlan: "with",
};

function initialFilterFor(
  view: RespondentRecommendationListView,
): RespondentRecommendationFilterValue {
  return { ...(view === "action-plan" ? ACTION_PLAN_INITIAL_FILTER : ANALYSIS_INITIAL_FILTER) };
}

function normalizeFilterForView(
  view: RespondentRecommendationListView,
  filter: RespondentRecommendationFilterValue,
): RespondentRecommendationFilterValue {
  return view === "action-plan" ? { ...filter, withPlan: "with" } : filter;
}

function filterForViewSwitch(
  view: RespondentRecommendationListView,
  filter: RespondentRecommendationFilterValue,
): RespondentRecommendationFilterValue {
  return normalizeFilterForView(view, {
    ...filter,
    status: "",
    pendingOnly: false,
    withPlan: view === "action-plan" ? "with" : "all",
  });
}

function filterFromSearchParams(
  view: RespondentRecommendationListView,
  searchParams: Pick<URLSearchParams, "get">,
): RespondentRecommendationFilterValue {
  const allowedStatuses = new Set<RespondentRecommendationFilterValue["status"]>([
    "generated",
    "in_action_plan",
    "adjustment_requested",
    "exception_requested",
    "awaiting_approval",
    "completed",
    "dismissed",
  ]);
  const rawStatus = searchParams.get("status")?.trim() ?? "";
  const rawWithPlan = searchParams.get("withPlan")?.trim() ?? "all";
  const withPlan =
    rawWithPlan === "with" || rawWithPlan === "without" ? rawWithPlan : "all";

  return normalizeFilterForView(view, {
    ...initialFilterFor(view),
    search: searchParams.get("search")?.trim() ?? "",
    status: searchParams.get("focus")?.trim() === "awaiting_action"
      ? "generated"
      : allowedStatuses.has(rawStatus as RespondentRecommendationFilterValue["status"])
        ? (rawStatus as RespondentRecommendationFilterValue["status"])
        : "",
    cycleId: uuidParamOrEmpty(searchParams.get("cycleId")),
    formId: uuidParamOrEmpty(searchParams.get("formId")),
    axisId: uuidParamOrEmpty(searchParams.get("axisId")),
    withPlan,
    pendingOnly:
      searchParams.get("pendingOnly") === "1" ||
      searchParams.get("focus")?.trim() === "awaiting_action",
  });
}

function sameFilter(
  left: RespondentRecommendationFilterValue,
  right: RespondentRecommendationFilterValue,
): boolean {
  return (
    left.search === right.search &&
    left.status === right.status &&
    left.cycleId === right.cycleId &&
    left.formId === right.formId &&
    left.axisId === right.axisId &&
    left.withPlan === right.withPlan &&
    left.pendingOnly === right.pendingOnly
  );
}

function toNavigationFilter(
  filter: RespondentRecommendationFilterValue,
  page?: number,
): RespondentRecommendationListFilter {
  return { ...filter, page };
}

function matchesText(item: RespondentRecommendationItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.recommendationText} ${item.axisName} ${item.sectionName} ${item.formName} ${item.questionPrompt}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function applyFilters(
  rows: RespondentRecommendationItem[],
  filter: RespondentRecommendationFilterValue,
  debouncedSearch: string,
): RespondentRecommendationItem[] {
  return rows.filter((item) => {
    if (debouncedSearch && !matchesText(item, debouncedSearch.trim())) return false;
    if (filter.status && item.status !== filter.status) return false;
    if (filter.cycleId && item.cycleId !== filter.cycleId) return false;
    if (filter.formId && item.formId !== filter.formId) return false;
    if (filter.axisId && item.axisId !== filter.axisId) return false;
    if (filter.withPlan === "with" && !item.hasPlan) return false;
    if (filter.withPlan === "without" && item.hasPlan) return false;
    if (filter.pendingOnly && !item.needsAction) return false;
    return true;
  });
}

function summaryKeyToFilterPatch(
  key: SummaryCardKey,
): Partial<RespondentRecommendationFilterValue> | null {
  switch (key) {
    case "total":
      return null;
    case "in_progress":
      return { status: "in_action_plan" };
    case "resolved":
      return { status: "completed" };
    case "awaiting_action":
      return { status: "generated", pendingOnly: true };
  }
}

function filterToActiveSummaryKey(
  filter: RespondentRecommendationFilterValue,
): SummaryCardKey | null {
  const noOtherFilters =
    !filter.cycleId &&
    !filter.formId &&
    !filter.axisId &&
    filter.withPlan === "all" &&
    !filter.search.trim();

  if (filter.pendingOnly && filter.status === "generated" && noOtherFilters) {
    return "awaiting_action";
  }
  if (filter.status && noOtherFilters && !filter.pendingOnly) {
    if (filter.status === "in_action_plan") return "in_progress";
    if (filter.status === "completed") return "resolved";
  }
  return null;
}

export function RespondentRecommendationsShell() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const view = respondentRecommendationView(searchParams);
  const actionPlanView = view === "action-plan";

  const { rows, summary, loading, error, formOptions, axisOptions, refetch } =
    useRespondentRecommendations();

  const [filter, setFilter] = useState<RespondentRecommendationFilterValue>(() =>
    filterFromSearchParams(view, searchParams),
  );
  const debouncedSearch = useDebounce(filter.search, 250);

  const filteredRows = useMemo(
    () => applyFilters(rows, filter, debouncedSearch),
    [rows, filter, debouncedSearch],
  );
  const paginationResetKey = useMemo(
    () =>
      [
        view,
        debouncedSearch,
        filter.status,
        filter.cycleId,
        filter.formId,
        filter.axisId,
        filter.withPlan,
        filter.pendingOnly ? "1" : "0",
      ].join("|"),
    [debouncedSearch, filter, view],
  );
  const pagination = usePagination({
    totalItems: filteredRows.length,
    pageSize: 10,
    resetKey: paginationResetKey,
    initialPage: respondentRecommendationPage(searchParams),
  });
  const pagedRows = pagination.pageItems(filteredRows);
  const activeSummaryKey = useMemo(
    () => (actionPlanView ? null : filterToActiveSummaryKey(filter)),
    [actionPlanView, filter],
  );
  const actionPlanSectionCount = useMemo(
    () => buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(filteredRows)).reduce(
      (total, axis) => total + axis.sections.length,
      0,
    ),
    [filteredRows],
  );
  const actionPlanTotalSectionCount = useMemo(
    () => buildSectionActionPlanHierarchy(
      sectionActionPlanSourcesFromListItems(rows.filter((item) => item.hasPlan)),
    ).reduce((total, axis) => total + axis.sections.length, 0),
    [rows],
  );
  const totalForView = actionPlanView ? actionPlanTotalSectionCount : summary.total;
  const selectedCycleLabel = useMemo(() => {
    if (!filter.cycleId) return null;
    const selected = rows.find((item) => item.cycleId === filter.cycleId);
    return selected ? `${selected.formName} · ${selected.periodLabel}` : null;
  }, [filter.cycleId, rows]);

  const listPath = useMemo(
    () => respondentRecommendationListPath(view, toNavigationFilter(filter, pagination.page)),
    [filter, pagination.page, view],
  );
  const analysisTabPath = useMemo(
    () =>
      respondentRecommendationListPath(
        "analysis",
        toNavigationFilter(filterForViewSwitch("analysis", filter)),
      ),
    [filter],
  );
  const actionPlanTabPath = useMemo(
    () =>
      respondentRecommendationListPath(
        "action-plan",
        toNavigationFilter(filterForViewSwitch("action-plan", filter)),
      ),
    [filter],
  );

  useEffect(() => {
    const nextFilter = filterFromSearchParams(view, searchParams);
    const rawRecommendationId = searchParams.get("recommendationId");
    const recommendationId = parseUuidParam(rawRecommendationId);
    if (recommendationId) {
      const returnTo = respondentRecommendationListPath(
        view,
        toNavigationFilter(nextFilter, respondentRecommendationPage(searchParams)),
      );
      router.replace(
        respondentActionWorkspacePath(recommendationId, "visao-geral", { returnTo }),
      );
      return;
    }
    if (rawRecommendationId?.trim()) {
      router.replace(
        respondentRecommendationListPath(view, toNavigationFilter(nextFilter)),
        { scroll: false },
      );
      return;
    }
    if (["cycleId", "formId", "axisId"].some((key) => isInvalidUuidParam(searchParams.get(key)))) {
      router.replace(
        respondentRecommendationListPath(view, toNavigationFilter(nextFilter)),
        { scroll: false },
      );
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Sincroniza o filtro local com os parâmetros de busca externos da rota.
    setFilter((previous) => (sameFilter(previous, nextFilter) ? previous : nextFilter));
  }, [router, searchParams, view]);

  // URL ← estado só em handlers (updateFilter / clear / summary). Um efeito
  // contínuo state→URL reescrevia filtros antigos na troca de aba e fazia a
  // tela alternar sozinha.

  const updateFilter = useCallback(
    (next: RespondentRecommendationFilterValue) => {
      const normalized = normalizeFilterForView(view, next);
      setFilter(normalized);
      const nextPath = respondentRecommendationListPath(view, toNavigationFilter(normalized));
      const currentPath = searchParams.size > 0
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (nextPath !== currentPath) {
        router.replace(nextPath, { scroll: false });
      }
    },
    [pathname, router, searchParams, view],
  );

  const handleFilterChange = useCallback(
    (next: RespondentRecommendationFilterValue) => {
      updateFilter(next);
    },
    [updateFilter],
  );

  const handleClear = useCallback(() => updateFilter(initialFilterFor(view)), [updateFilter, view]);

  const handleSummarySelect = useCallback(
    (key: SummaryCardKey) => {
      const patch = summaryKeyToFilterPatch(key);
      updateFilter(patch ? { ...initialFilterFor("analysis"), ...patch } : initialFilterFor("analysis"));
    },
    [updateFilter],
  );

  async function handleRefresh() {
    try {
      await refetch();
      notify.success("Conteúdo atualizado.");
    } catch {
      // O hook mantém a falha visível na página e oferece nova tentativa.
    }
  }

  async function handleExport(format: RecommendationPortfolioExportFormat) {
    if (filteredRows.length === 0) {
      notify.info(
        actionPlanView
          ? "Nenhum plano de ação para exportar."
          : "Nenhuma recomendação para exportar.",
      );
      return;
    }
    const exportTask =
      actionPlanView && format !== "csv"
        ? downloadRespondentActionPlanExport(filteredRows, format)
        : downloadRespondentPortfolioExport(
            filteredRows,
            format,
            "portfolio-recomendacoes",
          );
    await notify.promise(exportTask, {
      loading: `Gerando ${format.toUpperCase()}...`,
      success: "Exportação iniciada.",
      error: (error) => describeError(error, "Falha ao exportar."),
    });
  }

  const hasActiveFilters =
    Boolean(filter.search.trim()) ||
    Boolean(filter.status) ||
    Boolean(filter.cycleId) ||
    Boolean(filter.formId) ||
    Boolean(filter.axisId) ||
    filter.withPlan !== (actionPlanView ? "with" : "all") ||
    filter.pendingOnly;

  const emptyVariant: EmptyVariant | null = (() => {
    if (filteredRows.length > 0) return null;
    if (rows.length === 0) return "no-recommendations";
    if (actionPlanView && !hasActiveFilters) {
      const hasEligibleRecommendationWithoutPlan = rows.some(
        (item) => item.canCreateActionPlan && !item.hasPlan,
      );
      const hasRecommendationAwaitingConsolidation = rows.some(
        (item) => !item.canCreateActionPlan,
      );
      if (!hasEligibleRecommendationWithoutPlan && hasRecommendationAwaitingConsolidation) {
        return "awaiting-consolidation";
      }
      return "no-plan-linked";
    }
    if (hasActiveFilters) return "no-results";
    return "no-recommendations";
  })();

  const listTitle = actionPlanView ? "Planos de ação" : "Recomendações";
  const listDescription = actionPlanView
    ? "Organizado em Diagnóstico → Eixo → Seção → Plano da seção → Ações. As recomendações permanecem como origem rastreável."
    : "Apresentadas na mesma sequência do diagnóstico, por eixo, seção e recomendação.";

  return (
    <div className={layout.pageStack}>
      <div className={RESPONDENT_PAGE_HERO_BLEED}>
        <RespondentRecommendationsHero
          view={view}
          onRefresh={handleRefresh}
          refreshing={loading}
          onExport={handleExport}
          exportDisabled={filteredRows.length === 0}
        />
      </div>

      <section className={`${layout.panelStack} pt-1`}>
        <nav
          className="flex flex-wrap gap-0 border-b border-slate-200/90 bg-slate-50/40"
          aria-label="Visões do workspace de recomendações"
        >
          <Link
            href={analysisTabPath}
            className={underlineTabLinkClass(!actionPlanView)}
            aria-current={!actionPlanView ? "page" : undefined}
          >
            Recomendações
          </Link>
          <Link
            href={actionPlanTabPath}
            className={underlineTabLinkClass(actionPlanView)}
            aria-current={actionPlanView ? "page" : undefined}
          >
            Plano de ação
          </Link>
        </nav>

        {error ? (
          <AsyncErrorState
            title={
              actionPlanView
                ? "Não foi possível carregar os planos de ação"
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
              onSelect={handleSummarySelect}
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
            onChange={handleFilterChange}
            onClear={handleClear}
            forms={formOptions}
            axes={axisOptions}
            resultCount={actionPlanView ? actionPlanSectionCount : filteredRows.length}
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
          {(actionPlanView ? actionPlanSectionCount : filteredRows.length) !== totalForView ? (
            <p className={typography.meta}>
              Exibindo{" "}
              <span className="font-medium tabular-nums text-slate-700">{actionPlanView ? actionPlanSectionCount : filteredRows.length}</span>{" "}
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
              onClearFilters={hasActiveFilters ? handleClear : undefined}
            />
          ) : (
            actionPlanView ? (
              <RespondentSectionActionPlanList items={filteredRows} returnPath={listPath} />
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
    </div>
  );
}
