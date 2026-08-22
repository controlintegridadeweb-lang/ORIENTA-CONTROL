"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EvidenceFilterOptions, EvidenceListItem } from "@/features/evidences/types";
import { loadEvidenceFilters } from "@/features/evidences/client";
import type { ValidationStatus } from "@/features/evidences/schemas";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { describeError } from "@/infrastructure/notifications/notify";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { EvidencesTableSkeleton } from "@/features/evidences/components/admin/evidences-skeleton";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { InlineLoader } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { AdminEvidencesHero } from "./admin-evidences-hero";
import { EvidenceDetailDrawer } from "./evidence-detail-drawer";
import { EvidencesCardsList } from "./evidences-cards-list";
import { EvidencesEmptyState } from "./evidences-empty-state";
import { EvidencesFilters, type EvidencesFilterState } from "./evidences-filters";
import { EvidencesKpiCards } from "./evidences-kpi-cards";
import { EvidencesTable } from "./evidences-table";
import { useEvidenceSelection } from "./hooks/use-evidence-selection";
import { useEvidencesList } from "./hooks/use-evidences-list";
import { adminEvidenceListPath } from "@/shared/navigation/evidence-list-paths";

const PAGE_SIZE = 25;

/** Status da fila administrativa (após envio). `pending` permanece no domínio do respondente. */
const ADMIN_QUEUE_STATUSES = new Set<string>(
  Object.keys(EVIDENCE_VALIDATION_REGISTRY).filter(
    (key) => key !== "pending" && key !== "not_required",
  ),
);

function normalizeEvidenceInitialStatus(
  value: string | ValidationStatus | undefined,
): "" | ValidationStatus {
  if (value == null || value === "") return "";
  const s = String(value);
  return ADMIN_QUEUE_STATUSES.has(s) ? (s as ValidationStatus) : "";
}

export type EvidencesShellInitialFilters = {
  cycleId?: string;
  questionId?: string;
  evidenceId?: string;
  organizationId?: string;
  formId?: string;
  status?: ValidationStatus;
  search?: string;
  from?: string;
  to?: string;
  offset?: number;
};

export function EvidencesShell({
  initialFilters: _initialFilters,
}: {
  initialFilters?: EvidencesShellInitialFilters;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filterOptions, setFilterOptions] = useState<EvidenceFilterOptions | null>(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null);
  const filter = useMemo<EvidencesFilterState>(() => ({
    cycleId: searchParams.get("cycleId")?.trim() ?? "",
    questionId: searchParams.get("questionId")?.trim() ?? "",
    evidenceId: searchParams.get("evidenceId")?.trim() ?? "",
    formId: searchParams.get("formId")?.trim() ?? "",
    organizationId: searchParams.get("organizationId")?.trim() ?? "",
    status: normalizeEvidenceInitialStatus(searchParams.get("status") ?? undefined),
    search: searchParams.get("search")?.trim() ?? "",
    from: searchParams.get("from")?.trim() ?? "",
    to: searchParams.get("to")?.trim() ?? "",
  }), [searchParams]);
  const offset = useMemo(() => {
    const value = Number(searchParams.get("offset") ?? "0");
    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [searchParams]);
  const [drawerItem, setDrawerItem] = useState<EvidenceListItem | null>(null);
  const [dismissedEvidenceId, setDismissedEvidenceId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const debouncedSearch = useDebounce(filter.search, 250);
  const focusedEvidenceIds = useMemo(
    () => (filter.evidenceId ? [filter.evidenceId] : undefined),
    [filter.evidenceId],
  );
  const selection = useEvidenceSelection();
  const { clear: clearSelection } = selection;

  const { result, loading, error: listError, refetch } = useEvidencesList({
    cycleId: filter.cycleId || undefined,
    questionId: filter.questionId || undefined,
    ids: focusedEvidenceIds,
    formId: filter.formId || undefined,
    organizationId: filter.organizationId || undefined,
    status: filter.status || undefined,
    search: debouncedSearch.trim() || undefined,
    from: filter.from || undefined,
    to: filter.to || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    setFilterOptionsError(null);
    try {
      setFilterOptions(await loadEvidenceFilters());
    } catch (caught) {
      setFilterOptionsError(describeError(caught, "Falha ao carregar as opções de filtro."));
    } finally {
      setFilterOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona das opções de filtro ao montar a tela.
    void loadFilterOptions();
  }, [loadFilterOptions]);


  const statsFilters = useMemo(
    () => ({
      cycleId: filter.cycleId || undefined,
      questionId: filter.questionId || undefined,
      ids: focusedEvidenceIds,
      formId: filter.formId || undefined,
      organizationId: filter.organizationId || undefined,
      search: debouncedSearch.trim() || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
    }),
    [
      filter.cycleId,
      filter.questionId,
      focusedEvidenceIds,
      filter.formId,
      filter.organizationId,
      debouncedSearch,
      filter.from,
      filter.to,
    ],
  );

  const exportFilters = useMemo(
    () => ({
      ...statsFilters,
      status: filter.status || undefined,
    }),
    [statsFilters, filter.status],
  );

  const navigateToEvidenceState = useCallback((next: EvidencesFilterState, nextOffset = 0) => {
    router.replace(
      adminEvidenceListPath({
        cycleId: next.cycleId,
        questionId: next.questionId,
        evidenceId: next.evidenceId,
        formId: next.formId,
        organizationId: next.organizationId,
        status: next.status,
        search: next.search,
        from: next.from,
        to: next.to,
        offset: nextOffset,
      }),
      { scroll: false },
    );
  }, [router]);

  const handleFilterChange = useCallback((next: EvidencesFilterState) => {
    let normalized = next;
    if (next.organizationId !== filter.organizationId) {
      normalized = { ...next, formId: "", cycleId: "", questionId: "", evidenceId: "" };
    } else if (next.formId !== filter.formId) {
      normalized = { ...next, cycleId: "", questionId: "", evidenceId: "" };
    } else if (next.cycleId !== filter.cycleId || next.questionId !== filter.questionId) {
      normalized = { ...next, evidenceId: "" };
    }
    navigateToEvidenceState(normalized);
  }, [filter, navigateToEvidenceState]);

  const handleSelectStatus = useCallback((status: "" | ValidationStatus) => {
    navigateToEvidenceState({ ...filter, status });
  }, [filter, navigateToEvidenceState]);

  const handleClear = useCallback(() => {
    navigateToEvidenceState({
      cycleId: "",
      questionId: "",
      evidenceId: "",
      formId: "",
      organizationId: "",
      status: "",
      search: "",
      from: "",
      to: "",
    });
    clearSelection();
  }, [clearSelection, navigateToEvidenceState]);

  async function handleRefresh() {
    setRefreshSignal((current) => current + 1);
    await Promise.all([refetch(), loadFilterOptions()]);
  }

  const items = useMemo(() => result?.items ?? [], [result?.items]);
  const total = result?.total ?? 0;
  const pageStart = items.length > 0 ? offset + 1 : 0;
  const pageEnd = offset + items.length;
  const pageIds = useMemo(() => items.map((i) => i.id), [items]);
  const allPageSelected = selection.isAllOnPage(pageIds);

  const returnPath = useMemo(
    () =>
      adminEvidenceListPath({
        cycleId: filter.cycleId,
        questionId: filter.questionId,
        evidenceId: filter.evidenceId,
        formId: filter.formId,
        organizationId: filter.organizationId,
        status: filter.status,
        search: filter.search,
        from: filter.from,
        to: filter.to,
        offset,
      }),
    [filter, offset],
  );

  const focusedEvidence = useMemo(
    () => result?.items.find((item) => item.id === filter.evidenceId) ?? null,
    [filter.evidenceId, result?.items],
  );
  const effectiveDrawerItem =
    drawerItem ??
    (filter.evidenceId && dismissedEvidenceId !== filter.evidenceId ? focusedEvidence : null);
  const openEvidenceDetail = useCallback((item: EvidenceListItem) => {
    setDismissedEvidenceId(null);
    setDrawerItem(item);
  }, []);

  const hasActiveFilters =
    Boolean(filter.cycleId) ||
    Boolean(filter.questionId) ||
    Boolean(filter.evidenceId) ||
    Boolean(filter.formId) ||
    Boolean(filter.organizationId) ||
    Boolean(filter.status) ||
    Boolean(filter.search.trim()) ||
    Boolean(filter.from) ||
    Boolean(filter.to);

  const content = (
    <>
      <PanelSection
        title="Indicadores"
        description="Selecione um indicador para filtrar a lista."
        variant="plain"
      >
        <EvidencesKpiCards
          filters={statsFilters}
          refreshSignal={refreshSignal}
          activeStatus={filter.status}
          onSelectStatus={handleSelectStatus}
        />
      </PanelSection>

      <PanelSection
        title="Filtros"
        description="Refine a consulta de evidências."
        variant="plain"
      >
        {filterOptionsLoading && !filterOptions ? (
          <InlineLoader label="Carregando opções de filtro…" />
        ) : null}
        {filterOptionsError ? (
          <AsyncErrorState
            compact
            title={filterOptions ? "As opções de filtro podem estar desatualizadas" : undefined}
            message={filterOptionsError}
            onRetry={loadFilterOptions}
            retrying={filterOptionsLoading}
          />
        ) : null}
        <EvidencesFilters
          options={filterOptions}
          value={filter}
          onChange={handleFilterChange}
          onClear={handleClear}
          loading={loading || filterOptionsLoading}
        />
      </PanelSection>

      <div className="space-y-3">
        {listError && result ? (
          <AsyncErrorState
            compact
            title="A lista pode estar desatualizada"
            message={listError}
            onRetry={refetch}
            retrying={loading}
          />
        ) : null}

        {loading && items.length === 0 ? (
          <EvidencesTableSkeleton />
        ) : listError && !result ? (
          <AsyncErrorState
            message={listError}
            onRetry={refetch}
            retrying={loading}
          />
        ) : items.length === 0 ? (
          <EvidencesEmptyState
            onClearFilters={handleClear}
            hasActiveFilters={hasActiveFilters}
          />
        ) : (
          <>
            <EvidencesTable
              items={items}
              selected={selection.selected}
              onToggleSelect={selection.toggle}
              onToggleAllPage={() => selection.toggleAllOnPage(pageIds)}
              allPageSelected={allPageSelected}
              onOpenDetail={openEvidenceDetail}
            />
            <EvidencesCardsList
              items={items}
              selected={selection.selected}
              onToggleSelect={selection.toggle}
              onOpenDetail={openEvidenceDetail}
            />
          </>
        )}
      </div>

      {total > 0 && !(listError && !result) ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:px-5 ${formSurface.card}`}
        >
          <span>
            Mostrando{" "}
            <span className="font-semibold text-slate-700">{pageStart}-{pageEnd}</span> de{" "}
            <span className="font-semibold text-slate-700">{total}</span> evidências
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => navigateToEvidenceState(filter, Math.max(0, offset - PAGE_SIZE))}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Anterior
            </button>
            <button
              type="button"
              disabled={pageEnd >= total || loading}
              onClick={() => navigateToEvidenceState(filter, offset + PAGE_SIZE)}
              className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <EvidenceDetailDrawer
        item={effectiveDrawerItem}
        open={effectiveDrawerItem != null}
        onClose={() => {
          setDrawerItem(null);
          if (filter.evidenceId) setDismissedEvidenceId(filter.evidenceId);
        }}
        returnPath={returnPath}
      />
    </>
  );

  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminEvidencesHero
          onRefresh={handleRefresh}
          refreshing={loading || filterOptionsLoading}
          exportFilters={exportFilters}
          selectedIds={selection.selectedIds}
        />
      </div>

      <section className={`${layout.panelStack} pt-1`}>{content}</section>
    </div>
  );
}
