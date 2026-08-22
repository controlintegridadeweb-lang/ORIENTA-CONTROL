"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SegmentedTabs } from "@/shared/ui/components/segmented-tabs";
import {
  getAnswersOverview,
  getAnswersSummary,
} from "@/features/forms/answers-client";
import {
  type AnswersListFilters,
  type AnswersOverview,
  type AnswersSummary,
} from "@/features/forms/answers-types";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import {
  FormManagementSection,
  FormTabPanel,
} from "@/features/forms/components/form/form-tab-panel";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import { formSurface } from "@/shared/layout/form-surface";
import { AnswersOverviewCard } from "./answers-overview-card";
import { AnswersSummaryView } from "./answers-summary-view";
import { AnswersListView } from "./answers-list-view";
import { AnswersIndividualView } from "./answers-individual-view";
import { AnswersFilters } from "./answers-filters";
import { AnswersExportMenu } from "./answers-export-menu";
import {
  AnswersIndividualSkeleton,
  AnswersListSkeleton,
  AnswersOverviewSkeleton,
  AnswersSummarySkeleton,
} from "./answers-skeleton";
import { useAnswersFilters } from "@/features/forms/use-answers-filters";
import { useAnswersRespondent } from "@/features/forms/use-answers-respondent";

type ViewMode = "resumo" | "lista" | "individual";

export function AnswersShell({
  formId,
  initialCycleId = null,
}: {
  formId: string;
  /** Abre direto a visão individual do diagnóstico identificado por `cycleId`. */
  initialCycleId?: string | null;
}) {
  const [view, setView] = useState<ViewMode>(initialCycleId ? "individual" : "resumo");
  const [overview, setOverview] = useState<AnswersOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const initialDetailRequestedRef = useRef(false);

  const [summary, setSummary] = useState<AnswersSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const { filters, setFilters, filterOptions, filtersEqual, EMPTY_FILTERS } = useAnswersFilters({
    formId,
  });

  const {
    respondents,
    respondentsError,
    cursor,
    loadingMore,
    selectedCycleId,
    setSelectedCycleId,
    detail,
    detailLoading,
    detailError,
    loadRespondents,
    loadDetail,
  } = useAnswersRespondent({
    formId,
    filters,
    enabled: view === "lista",
  });

  useEffect(() => {
    if (!initialCycleId || initialDetailRequestedRef.current) return;
    initialDetailRequestedRef.current = true;
    void loadDetail(initialCycleId);
  }, [initialCycleId, loadDetail]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalida o resultado assíncrono anterior quando a fonte de dados muda.
    setOverview(null);
    setOverviewError(null);
    getAnswersOverview(formId)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setOverviewError(describeError(err, "Falha ao carregar."));
      });
    return () => {
      cancelled = true;
    };
  }, [formId]);

  useEffect(() => {
    if (view !== "resumo") return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalida o resultado assíncrono anterior quando a fonte de dados muda.
    setSummary(null);
    setSummaryError(null);
    getAnswersSummary(formId)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setSummaryError(describeError(err, "Falha ao carregar."));
      });
    return () => {
      cancelled = true;
    };
  }, [formId, view]);

  const respondentIndex = useMemo(() => {
    if (!selectedCycleId || !respondents) return -1;
    return respondents.findIndex((row) => row.cycleId === selectedCycleId);
  }, [selectedCycleId, respondents]);

  function handleSelect(cycleId: string) {
    void loadDetail(cycleId);
    setView("individual");
  }

  function handleBackToList() {
    setSelectedCycleId(null);
    setView("lista");
  }

  function handleFiltersChange(next: AnswersListFilters) {
    if (filtersEqual(filters, next)) return;
    setFilters(next);
  }

  function handleClearFilters() {
    handleFiltersChange(EMPTY_FILTERS);
  }

  function handlePrev() {
    if (!respondents || respondentIndex <= 0) return;
    void loadDetail(respondents[respondentIndex - 1]!.cycleId);
  }

  function handleNext() {
    if (!respondents) return;
    const next = respondentIndex + 1;
    if (next >= respondents.length) {
      if (cursor) {
        void loadRespondents(false).then((page) => {
          const firstRowInNextPage = page?.rows[0];
          if (firstRowInNextPage) void loadDetail(firstRowInNextPage.cycleId);
        });
      }
      return;
    }
    void loadDetail(respondents[next]!.cycleId);
  }

  return (
    <FormTabPanel
      title="Respostas"
      description="Acompanhe o resumo agregado, a lista de respondentes e o detalhe individual de cada diagnóstico."
    >
      <div className={formManagementUi.sectionStack}>
        {overviewError ? (
          <div className={formSurface.messageError} role="alert">
            {overviewError}
          </div>
        ) : !overview ? (
          <AnswersOverviewSkeleton />
        ) : (
          <AnswersOverviewCard overview={overview} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            aria-label="Modos de visualização das respostas"
            items={[
              { id: "resumo", label: "Resumo" },
              { id: "lista", label: "Respondentes" },
              { id: "individual", label: "Individual" },
            ]}
            value={view}
            onChange={(id) => {
              if (id === "individual" && !selectedCycleId) {
                setView("lista");
                notify.info("Selecione um respondente na lista.");
                return;
              }
              setView(id);
            }}
          />
          <AnswersExportMenu formId={formId} filters={filters} />
        </div>

        {view === "resumo" ? (
          <FormManagementSection
            title="Resumo agregado"
            description="Distribuição das respostas por pergunta."
          >
            {summaryError ? (
              <div className={formSurface.messageError} role="alert">
                {summaryError}
              </div>
            ) : !summary ? (
              <AnswersSummarySkeleton />
            ) : (
              <AnswersSummaryView summary={summary} />
            )}
          </FormManagementSection>
        ) : null}

        {view === "lista" ? (
          <FormManagementSection
            title="Lista de respondentes"
            description="Cada linha representa um diagnóstico específico, preservando o histórico por período."
          >
            <div className="space-y-4">
              <AnswersFilters
                filters={filters}
                options={filterOptions}
                onChange={handleFiltersChange}
                onClear={handleClearFilters}
              />
              {respondentsError ? (
                <div className={formSurface.messageError} role="alert">
                  {respondentsError}
                </div>
              ) : !respondents ? (
                <AnswersListSkeleton />
              ) : (
                <AnswersListView
                  rows={respondents}
                  hasMore={Boolean(cursor)}
                  loadingMore={loadingMore}
                  onLoadMore={() => loadRespondents(false)}
                  onSelect={handleSelect}
                />
              )}
            </div>
          </FormManagementSection>
        ) : null}

        {view === "individual" ? (
          <FormManagementSection
            title="Visualização individual"
            description="Respostas completas do respondente selecionado."
          >
            {detailLoading ? (
              <AnswersIndividualSkeleton />
            ) : detailError ? (
              <div className={formSurface.messageError} role="alert">
                {detailError}
              </div>
            ) : !detail ? (
              <p className={formSurface.messageNeutral}>
                Selecione um respondente na lista para ver as respostas.
              </p>
            ) : (
              <AnswersIndividualView
                detail={detail}
                position={{
                  current: respondentIndex >= 0 ? respondentIndex + 1 : 1,
                  total: respondents?.length ?? 1,
                }}
                onBack={handleBackToList}
                onPrev={respondents && respondentIndex > 0 ? handlePrev : null}
                onNext={
                  respondents &&
                  respondentIndex >= 0 &&
                  (respondentIndex + 1 < respondents.length || Boolean(cursor))
                    ? handleNext
                    : null
                }
              />
            )}
          </FormManagementSection>
        ) : null}
      </div>
    </FormTabPanel>
  );
}
