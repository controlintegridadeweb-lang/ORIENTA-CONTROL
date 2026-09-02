"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedTabs } from "@/shared/ui/components/segmented-tabs";
import { interpretSnapshot } from "@/features/fami/respondent-presentation";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import { useRespondentFami } from "./hooks/use-respondent-fami";
import { RespondentFamiHero } from "./respondent-fami-hero";
import { RespondentFamiFilters } from "./respondent-fami-filters";
import { RespondentFamiScopeBanner } from "./respondent-fami-scope-banner";
import { RespondentFamiInsights } from "./respondent-fami-insights";
import { RespondentFamiSectionList } from "./respondent-fami-section-list";
import { RespondentFamiEvolution } from "./respondent-fami-evolution";
import { RespondentFamiRecommendationsImpact } from "./respondent-fami-recommendations-impact";
import { RespondentFamiEvidenceImpact } from "./respondent-fami-evidence-impact";
import { RespondentFamiEmptyState } from "./respondent-fami-empty-state";
import { FamiMethodologyGuide } from "@/features/fami/components/admin/fami-methodology-guide";
import { FamiEixosTab } from "@/features/fami/components/admin/tabs/fami-eixos-tab";
import { respondentFamiPath, type RespondentFamiTab } from "@/shared/navigation/fami-paths";
import { respondentBimonthlyReportsPath } from "@/shared/navigation/report-paths";
import { buildFamiCsv, downloadFamiCsv } from "@/features/fami/components/admin/fami-maturity-helpers";
import { FamiPreliminaryPanel } from "@/features/fami/components/preliminary/fami-preliminary-panel";
import { useFamiPreliminary } from "@/features/fami/components/preliminary/use-fami-preliminary";
import { FamiAnnualResultCard } from "@/features/fami/components/fami-annual-result-card";
import { currentBrtYear, getCalendarYearBrt } from "@/features/fami/fami-year";

type Props = {
  defaultOrganizationId: string | null;
  /** Diagnóstico preselecionado ao chegar de uma jornada concluída. */
  defaultCycleId?: string | null;
  defaultSnapshotYear?: number | null;
  defaultTab?: RespondentFamiTab;
};

type TabId = RespondentFamiTab;

function recommendationsPath(cycleId: string | undefined, axisId?: string | null): string {
  const params = new URLSearchParams();
  if (cycleId) params.set("cycleId", cycleId);
  if (axisId) params.set("axisId", axisId);
  const query = params.toString();
  return query
    ? `/respondente/portfolio-recomendacoes?${query}`
    : "/respondente/portfolio-recomendacoes";
}

export function RespondentFamiShell({
  defaultOrganizationId,
  defaultCycleId,
  defaultSnapshotYear,
  defaultTab = "panorama",
}: Props) {
  const router = useRouter();
  const {
    state,
    organizationId,
    setScopeId,
    setSnapshotYearFilter,
    snapshotYearFilter,
    refresh,
    axisStats,
    activeSnapshot,
    selectedCycle,
  } = useRespondentFami(
    defaultOrganizationId,
    defaultCycleId,
    defaultSnapshotYear,
  );

  const [tab, setTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mantém a aba local sincronizada com a URL ao usar voltar/avançar.
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!selectedCycle) return;
    if (selectedCycle.id === defaultCycleId) return;
    router.replace(
      respondentFamiPath({
        cycleId: selectedCycle.id,
        year: snapshotYearFilter,
        tab,
      }),
      { scroll: false },
    );
  }, [defaultCycleId, router, selectedCycle, snapshotYearFilter, tab]);

  function handleScopeChange(nextCycleId: string) {
    setScopeId(nextCycleId);
    setSnapshotYearFilter(null);
    router.push(respondentFamiPath({ cycleId: nextCycleId, tab }), { scroll: false });
  }

  function handleSnapshotYearChange(year: number | null) {
    setSnapshotYearFilter(year);
    router.push(
      respondentFamiPath({ cycleId: selectedCycle?.id ?? state.scopeId, year, tab }),
      { scroll: false },
    );
  }

  function handleTabChange(nextTab: TabId) {
    setTab(nextTab);
    router.push(
      respondentFamiPath({
        cycleId: selectedCycle?.id ?? state.scopeId,
        year: snapshotYearFilter,
        tab: nextTab,
      }),
      { scroll: false },
    );
  }

  const detailSnapshot = activeSnapshot?.snapshot ?? null;
  const detailMeta = activeSnapshot?.latestVersionMeta ?? null;
  const preliminaryReferenceYear = snapshotYearFilter ?? (detailMeta?.createdAt ? getCalendarYearBrt(detailMeta.createdAt) : currentBrtYear());
  const preliminary = useFamiPreliminary(selectedCycle?.id, preliminaryReferenceYear);
  const evolutionByYear = activeSnapshot?.evolutionByYear ?? [];
  const availableYears = activeSnapshot?.availableYears ?? [];

  const insights = useMemo(() => interpretSnapshot(detailSnapshot), [detailSnapshot]);
  const recommendationTotals = useMemo(() => {
    let openCount = 0;
    let awaitingActionCount = 0;
    for (const row of axisStats.values()) {
      openCount += row.recommendationsOpen;
      awaitingActionCount += row.awaitingAction;
    }
    return { openCount, awaitingActionCount };
  }, [axisStats]);

  const orgName =
    state.filters?.organizations.find((o) => o.id === organizationId)?.name ?? "";
  const selectedForm = selectedCycle
    ? { id: selectedCycle.formId, name: selectedCycle.formName, version: selectedCycle.formVersion }
    : null;
  const recommendationsHref = recommendationsPath(selectedCycle?.id);
  const evidencesHref = selectedCycle
    ? `/respondente/evidencias?view=all&cycleId=${encodeURIComponent(selectedCycle.id)}`
    : "/respondente/evidencias";

  const priorityAxis = insights.bottomAxis;
  const priorityCta =
    priorityAxis && priorityAxis !== insights.topAxis
      ? {
          href: recommendationsPath(selectedCycle?.id, priorityAxis.axisId),
          label: `Tratar recomendações · ${priorityAxis.axisName}`,
        }
      : null;

  function handleExport() {
    if (!detailSnapshot) return;
    const scopeLabel = selectedForm?.name ?? "diagnostico";
    const csv = buildFamiCsv(detailSnapshot, { globalLabel: scopeLabel });
    downloadFamiCsv(csv, `fami-${orgName || "organizacao"}-${scopeLabel}.csv`);
  }

  const hero = (
    <div className={RESPONDENT_PAGE_HERO_BLEED}>
      <RespondentFamiHero
        onRefresh={() => {
          void refresh();
          void preliminary.reload();
        }}
        refreshing={state.loading || state.refreshing}
        onExport={handleExport}
        exportDisabled={!detailSnapshot?.global}
      />
    </div>
  );

  if (state.loading) {
    return (
      <div className={layout.pageStack}>
        {hero}
        <section className="space-y-6">
          <div className={`h-40 ${formSurface.skeleton} rounded-xl border border-slate-200`} />
          <div className={`h-24 ${formSurface.skeleton} rounded-xl border border-slate-200`} />
        </section>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={layout.pageStack}>
        {hero}
        <section className={formSurface.messageError}>
          Não foi possível carregar os dados FAMI. {state.error}
        </section>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className={layout.pageStack}>
        {hero}
        <section className={formSurface.messageWarning}>
          Seu perfil não está vinculado a uma organização. Solicite ao administrador a
          associação para visualizar o Resultado FAMI dos seus diagnósticos.
        </section>
      </div>
    );
  }

  if (state.cycles.length === 0) {
    return (
      <div className={layout.pageStack}>
        {hero}
        <section className="space-y-5 sm:space-y-6">
          <FamiMethodologyGuide currentLevel={null} showAvailabilityNotice />
          <RespondentFamiEmptyState kind="no-completed-cycle" />
        </section>
      </div>
    );
  }

  return (
    <div className={layout.pageStack}>
      {hero}
      <section className="space-y-5 sm:space-y-6">
        {/* Guia metodológico — acima do seletor de diagnóstico (referência de página). */}
        <FamiMethodologyGuide
          currentLevel={detailSnapshot?.global?.maturityLevel ?? null}
          showAvailabilityNotice={!detailSnapshot?.global}
        />

        <PanelSection
          title="Diagnóstico"
          description="Escolha o diagnóstico e o ano. O ano vale para o processamento oficial e para o acompanhamento quadrimestral."
          variant="plain"
        >
          <RespondentFamiFilters
            cycles={state.cycles}
            scopeId={state.scopeId}
            onScopeChange={handleScopeChange}
            availableYears={availableYears}
            snapshotYear={snapshotYearFilter}
            onSnapshotYearChange={handleSnapshotYearChange}
            filtersDisabled={state.refreshing}
          />
        </PanelSection>

        {selectedForm ? (
          <RespondentFamiScopeBanner
            percentage={detailSnapshot?.global?.percentage ?? null}
            level={detailSnapshot?.global?.maturityLevel ?? null}
            lastProcessedAt={detailMeta?.createdAt ?? detailSnapshot?.global?.createdAt ?? null}
          />
        ) : null}

        {detailSnapshot?.integrityWarnings?.length ? (
          <div role="alert" aria-live="assertive" className={`${formSurface.messageWarning} space-y-2`}>
            <p className="font-semibold">O resultado histórico possui inconsistências de integridade.</p>
            {detailSnapshot.integrityWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {!detailSnapshot?.global ? (
          <RespondentFamiEmptyState kind="no-snapshot" yearFiltered={snapshotYearFilter} />
        ) : (
          <>
            <RespondentFamiInsights
              summary={insights.summary}
              cards={insights.cards}
              priorityCta={priorityCta}
            />

            <PanelSection title="Análise detalhada" variant="plain">
              <div className="space-y-4">
                <SegmentedTabs<TabId>
                  size="lg"
                  aria-label="Visões do FAMI"
                  value={tab}
                  onChange={handleTabChange}
                  items={[
                    { id: "panorama", label: "Panorama" },
                    { id: "eixos", label: "Por eixo" },
                    { id: "secoes", label: "Por seção" },
                    { id: "evolucao", label: "Evolução" },
                  ]}
                />

                {tab === "panorama" ? (
                  <>
                    <RespondentFamiRecommendationsImpact
                      openCount={recommendationTotals.openCount}
                      awaitingActionCount={recommendationTotals.awaitingActionCount}
                      recommendationsLink={recommendationsHref}
                    />
                    <RespondentFamiEvidenceImpact
                      stats={state.evidenceStats}
                      evidencesLink={evidencesHref}
                    />
                  </>
                ) : tab === "eixos" ? (
                  <FamiEixosTab axes={detailSnapshot.axes} />
                ) : tab === "secoes" ? (
                  <RespondentFamiSectionList sections={detailSnapshot.sections} />
                ) : (
                  <div className="space-y-6">
                    <RespondentFamiEvolution granularity="years" points={evolutionByYear} />
                    <FamiPreliminaryPanel
                      cycleId={selectedCycle?.id}
                      referenceYear={preliminaryReferenceYear}
                      canMaterialize={false}
                      payload={preliminary.payload}
                      loading={preliminary.loading}
                      submitting={preliminary.submitting}
                      error={preliminary.error}
                      message={preliminary.message}
                      bimonthlyHistoryHref={respondentBimonthlyReportsPath({
                        cycleId: selectedCycle?.id,
                      })}
                      onRetry={() => void preliminary.reload()}
                      onCalculate={(quadrimester) => void preliminary.calculate(quadrimester)}
                    />
                    <FamiAnnualResultCard
                      referenceYear={preliminaryReferenceYear}
                      percentage={detailSnapshot?.global?.percentage}
                      maturityLevel={detailSnapshot?.global?.maturityLevel}
                      pointsObtained={detailSnapshot?.global?.pointsObtained}
                      pointsPossible={detailSnapshot?.global?.pointsPossible}
                      consolidatedAt={detailMeta?.createdAt ?? detailSnapshot?.global?.createdAt}
                    />
                  </div>
                )}
              </div>
            </PanelSection>
          </>
        )}
      </section>
    </div>
  );
}
