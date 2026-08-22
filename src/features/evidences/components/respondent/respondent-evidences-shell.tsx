"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import type { ValidationStatus } from "@/features/evidences/respondent-evidence-helpers";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { layout } from "@/shared/layout/design-system";
import { evidenceLabels } from "@/shared/labels/official-labels";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { SegmentedTabs } from "@/shared/ui/components/segmented-tabs";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import { respondentEvidenceListPath } from "@/shared/navigation/evidence-list-paths";
import { isInvalidUuidParam, uuidParamOrEmpty } from "@/shared/validation/uuid";
import { useRespondentEvidences } from "./hooks/use-respondent-evidences";
import { useRespondentStats } from "./hooks/use-respondent-stats";
import {
  RespondentEvidenceFilters,
  type CycleOption,
  type FormOption,
  type HierarchyOption,
  type RespondentFilterValue,
} from "./respondent-evidence-filters";
import { RespondentEvidenceDetailDrawer } from "./respondent-evidence-detail-drawer";
import { RespondentEvidenceSummaryCards } from "./respondent-evidence-summary-cards";
import { RespondentEvidencesHero } from "./respondent-evidences-hero";
import { RespondentEvidenceActionSection } from "./respondent-evidence-action-section";
import { RespondentEvidenceHistorySection } from "./respondent-evidence-history-section";

type EvidenceContentTab = "ajustes" | "lista";

const PAGE_SIZE = 20;
const ALLOWED_STATUSES = new Set<ValidationStatus>([
  "pending",
  "submitted",
  "approved",
  "invalidated",
  "adjustment_requested",
]);

export type RespondentEvidencesShellInitial = {
  status?: ValidationStatus;
  pendingOnly?: boolean;
  formId?: string;
  cycleId?: string;
  search?: string;
  axisName?: string;
  sectionName?: string;
  offset?: number;
};

function filterFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): RespondentFilterValue {
  const status = searchParams.get("status") ?? "";
  return {
    search: searchParams.get("search") ?? "",
    cycleId: uuidParamOrEmpty(searchParams.get("cycleId")),
    formId: uuidParamOrEmpty(searchParams.get("formId")),
    status: ALLOWED_STATUSES.has(status as ValidationStatus)
      ? status as ValidationStatus
      : "",
    axisName: searchParams.get("axisName")?.trim() ?? "",
    sectionName: searchParams.get("sectionName")?.trim() ?? "",
    pendingOnly: searchParams.get("pendingOnly") === "1",
  };
}

export function RespondentEvidencesShell({
  initial,
  formOptions,
  cycleOptions,
  hierarchyOptions,
}: {
  initial?: RespondentEvidencesShellInitial;
  formOptions: FormOption[];
  cycleOptions: CycleOption[];
  hierarchyOptions: HierarchyOption[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/respondente/evidencias";
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<RespondentFilterValue>(() => ({
    search: initial?.search ?? "",
    cycleId: initial?.cycleId ?? "",
    formId: initial?.formId ?? "",
    status: initial?.status ?? "",
    axisName: initial?.axisName ?? "",
    sectionName: initial?.sectionName ?? "",
    pendingOnly: Boolean(initial?.pendingOnly),
  }));
  const [offset, setOffset] = useState(initial?.offset ?? 0);
  const [contentTab, setContentTab] = useState<EvidenceContentTab>(() => {
    const status = initial?.status;
    if (status && status !== "adjustment_requested") return "lista";
    if (initial?.search || (initial?.offset ?? 0) > 0) return "lista";
    return "ajustes";
  });
  const [drawerItem, setDrawerItem] = useState<RespondentEvidenceItem | null>(null);
  const urlFilter = filterFromSearchParams(searchParams);
  const rawOffset = Number(searchParams.get("offset"));
  const urlOffset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const urlSnapshot = `${searchParams.toString()}::${urlOffset}`;
  const [appliedUrlSnapshot, setAppliedUrlSnapshot] = useState(urlSnapshot);

  if (appliedUrlSnapshot !== urlSnapshot) {
    setAppliedUrlSnapshot(urlSnapshot);
    setFilter((current) =>
      JSON.stringify(current) === JSON.stringify(urlFilter) ? current : urlFilter,
    );
    setOffset((current) => (current === urlOffset ? current : urlOffset));
  }

  const debouncedSearch = useDebounce(filter.search, 250);

  const fetchFilters = useMemo(() => ({
    cycleId: filter.cycleId || undefined,
    formId: filter.formId || undefined,
    search: debouncedSearch.trim() || undefined,
    axisName: filter.axisName || undefined,
    sectionName: filter.sectionName || undefined,
    status: filter.status || undefined,
    pendingOnly: filter.pendingOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  }), [debouncedSearch, filter, offset]);

  const evidenceList = useRespondentEvidences(fetchFilters);
  const pendingList = useRespondentEvidences({
    status: "adjustment_requested",
    pendingOnly: true,
    limit: 5,
    offset: 0,
  });
  const statsResult = useRespondentStats({
    cycleId: fetchFilters.cycleId,
    formId: fetchFilters.formId,
    search: fetchFilters.search,
    axisName: fetchFilters.axisName,
    sectionName: fetchFilters.sectionName,
  });

  const navigate = useCallback((nextFilter: RespondentFilterValue, nextOffset = 0) => {
    setFilter(nextFilter);
    setOffset(nextOffset);
    const href = respondentEvidenceListPath({ ...nextFilter, offset: nextOffset });
    const current = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;
    if (href !== current) router.replace(href, { scroll: false });
  }, [pathname, router, searchParams]);

  const clearFilters = useCallback(() => navigate({
    search: "",
    cycleId: "",
    formId: "",
    status: "",
    axisName: "",
    sectionName: "",
    pendingOnly: false,
  }), [navigate]);

  useEffect(() => {
    const rawCycleId = searchParams.get("cycleId");
    const rawFormId = searchParams.get("formId");
    if (!isInvalidUuidParam(rawCycleId) && !isInvalidUuidParam(rawFormId)) return;

    const nextFilter = filterFromSearchParams(searchParams);
    const nextOffsetRaw = Number(searchParams.get("offset"));
    const nextOffset = Number.isInteger(nextOffsetRaw) && nextOffsetRaw >= 0 ? nextOffsetRaw : 0;
    router.replace(respondentEvidenceListPath({ ...nextFilter, offset: nextOffset }), {
      scroll: false,
    });
  }, [router, searchParams]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      evidenceList.refetch(),
      statsResult.refetch(),
      pendingList.refetch(),
    ]);
  }, [evidenceList, pendingList, statsResult]);

  const summaryActiveKey = useMemo(() => {
    if (filter.pendingOnly || filter.status === "adjustment_requested") return "complementacao";
    if (filter.status === "approved") return "aprovadas";
    if (filter.status === "submitted") return "aguardando";
    if (filter.status === "invalidated") return "reprovadas";
    return null;
  }, [filter.pendingOnly, filter.status]);

  const items = evidenceList.result?.items ?? [];
  const total = evidenceList.result?.total ?? 0;
  const pendingItems = pendingList.result?.items ?? [];
  const pendingTotal = pendingList.result?.total ?? 0;
  const showingAdjustmentFocus = filter.status === "adjustment_requested" || filter.pendingOnly;
  const returnPath = respondentEvidenceListPath({ ...filter, offset });
  const hasActiveFilters = Boolean(
    filter.cycleId || filter.formId || filter.status || filter.axisName || filter.sectionName ||
    filter.search.trim() || filter.pendingOnly,
  );
  const stats = statsResult.stats;
  const statsAllZero =
    (stats?.enviadas ?? 0) === 0 &&
    (stats?.aprovadas ?? 0) === 0 &&
    (stats?.aguardando ?? 0) === 0 &&
    (stats?.reprovadas ?? 0) === 0 &&
    (stats?.complementacao ?? 0) === 0;

  return (
    <>
      <div className={layout.pageStack}>
        <div className={RESPONDENT_PAGE_HERO_BLEED}>
          <RespondentEvidencesHero
            onRefresh={handleRefresh}
            refreshing={evidenceList.loading || statsResult.loading || pendingList.loading}
          />
        </div>

        <section className={`${layout.panelStack} pt-1`}>
          <PanelSection
            title="Indicadores"
            description="Resumo do que você enviou. Selecione um cartão para filtrar a lista."
            variant="plain"
          >
            <div className="space-y-3">
              {statsResult.error ? (
                <AsyncErrorState
                  compact
                  title={stats ? "Os indicadores podem estar desatualizados" : undefined}
                  message={statsResult.error}
                  onRetry={statsResult.refetch}
                  retrying={statsResult.loading}
                />
              ) : null}
              {statsResult.error && !stats ? null : (
                <RespondentEvidenceSummaryCards
                  stats={stats}
                  loading={statsResult.loading && !stats}
                  activeKey={summaryActiveKey}
                  onSelect={(key, summaryFilter) => {
                    setContentTab(key === "complementacao" ? "ajustes" : "lista");
                    navigate({
                      search: "",
                      cycleId: filter.cycleId,
                      formId: filter.formId,
                      status: summaryFilter?.status ?? "",
                      axisName: filter.axisName,
                      sectionName: filter.sectionName,
                      pendingOnly: Boolean(summaryFilter?.pendingOnly),
                    });
                  }}
                />
              )}
            </div>
          </PanelSection>

          <PanelSection
            title="Filtros"
            description="Busca, formulário, situação, eixo e seção. Quando acessada a partir de um diagnóstico, esta tela mantém o diagnóstico selecionado."
            variant="plain"
          >
            <RespondentEvidenceFilters
              value={filter}
              onChange={(next) => navigate(next, 0)}
              onClear={clearFilters}
              forms={formOptions}
              cycles={cycleOptions}
              hierarchy={hierarchyOptions}
              resultCount={total}
            />
          </PanelSection>

          <div className={layout.sectionStack}>
            <SegmentedTabs<EvidenceContentTab>
              aria-label="Seções de evidências"
              items={[
                {
                  id: "ajustes",
                  label: pendingTotal > 0
                    ? `${evidenceLabels.sectionTitle} (${pendingTotal})`
                    : evidenceLabels.sectionTitle,
                },
                { id: "lista", label: "Lista de evidências" },
              ]}
              value={contentTab}
              onChange={setContentTab}
            />

            {contentTab === "ajustes" ? (
              <RespondentEvidenceActionSection
                pendingError={pendingList.error}
                pendingLoading={pendingList.loading}
                pendingAvailable={Boolean(pendingList.result)}
                pendingItems={pendingItems}
                pendingTotal={pendingTotal}
                returnPath={returnPath}
                navigate={(nextFilter, nextOffset) => {
                  setContentTab("lista");
                  navigate(nextFilter, nextOffset);
                }}
                retry={pendingList.refetch}
                openDetail={setDrawerItem}
              />
            ) : (
              <RespondentEvidenceHistorySection
                items={items}
                total={total}
                offset={offset}
                pageSize={PAGE_SIZE}
                filter={filter}
                loading={evidenceList.loading}
                listError={evidenceList.error}
                listAvailable={Boolean(evidenceList.result)}
                showingAdjustmentFocus={showingAdjustmentFocus}
                hasActiveFilters={hasActiveFilters}
                pendingTotal={pendingTotal}
                statsAllZero={statsAllZero}
                returnPath={returnPath}
                navigate={navigate}
                clearFilters={clearFilters}
                retry={evidenceList.refetch}
                openDetail={setDrawerItem}
              />
            )}
          </div>
        </section>
      </div>

      <RespondentEvidenceDetailDrawer
        open={drawerItem != null}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        returnPath={returnPath}
      />
    </>
  );
}
