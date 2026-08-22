"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { evolutionDeltaByYear } from "@/features/fami/respondent-presentation";
import { formSurface } from "@/shared/layout/form-surface";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { SegmentedTabs } from "@/shared/ui/components/segmented-tabs";
import { YearSelect } from "@/shared/ui/components/year-select";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { AdminFamiMaturityHero } from "@/features/fami/components/admin/admin-fami-maturity-hero";
import { adminQueueSegmentHref } from "@/features/admin";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { processingFileToken } from "@/features/fami/presentation-labels";
import { FamiMethodologyGuide } from "./fami-methodology-guide";
import { FamiMaturitySectionBreak } from "./fami-maturity-section-break";
import {
  FAMI_SECTION_STACK,
  buildFamiCsv,
  downloadFamiCsv,
  type TabId,
} from "./fami-maturity-helpers";
import { useFamiSnapshot } from "./use-fami-snapshot";
import { FamiResumoAdminTab } from "./tabs/fami-resumo-admin-tab";
import { FamiResumoBasicTab } from "./tabs/fami-resumo-basic-tab";
import { FamiEixosTab } from "./tabs/fami-eixos-tab";
import { FamiSecoesTab } from "./tabs/fami-secoes-tab";
import { FamiEvolucaoTab } from "./tabs/fami-evolucao-tab";
import { adminFamiPath, type AdminFamiTab } from "@/shared/navigation/fami-paths";
import { useFamiPreliminary } from "@/features/fami/components/preliminary/use-fami-preliminary";
import { currentBrtYear, getCalendarYearBrt } from "@/features/fami/fami-year";

type Props = {
  mode: "admin" | "respondent";
  /** Para admin, uma organização é escolhida antes de selecionar o diagnóstico. */
  defaultOrganizationId: string | null;
  /** Prefill do diagnóstico pelo formulário de origem, quando houver. */
  defaultFormId?: string | null;
  /** Diagnóstico preselecionado ao chegar do detalhe do diagnóstico. */
  defaultCycleId?: string | null;
  defaultSnapshotYear?: number | null;
  defaultTab?: AdminFamiTab;
};

/** Resultado FAMI sempre associado a um processamento concluído de um diagnóstico específico. */
export function FamiMaturityShell({
  mode,
  defaultOrganizationId,
  defaultFormId,
  defaultCycleId,
  defaultSnapshotYear,
  defaultTab = "resumo",
}: Props) {
  const router = useRouter();
  const {
    filters,
    filtersError,
    cyclesError,
    snapshotError,
    organizationId,
    setOrganizationId,
    cycles,
    cycleId,
    setCycleId,
    tab,
    setTab,
    data,
    loading,
    reconciliationLoading,
    snapshotYearFilter,
    setSnapshotYearFilter,
    effectiveFormId,
    effectiveCycle,
    fetchSnapshot,
    fetchFilters,
    fetchCycles,
    handleReconciliation,
  } = useFamiSnapshot({
    mode,
    defaultOrganizationId,
    defaultFormId,
    defaultCycleId,
    defaultSnapshotYear,
    defaultTab,
  });


  function handleOrganizationChange(nextOrganizationId: string) {
    setOrganizationId(nextOrganizationId);
    setSnapshotYearFilter(null);
    router.push(
      adminFamiPath({ organizationId: nextOrganizationId, tab }),
      { scroll: false },
    );
  }

  function handleCycleChange(nextCycleId: string) {
    const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId) ?? null;
    setCycleId(nextCycleId);
    setSnapshotYearFilter(null);
    router.push(
      adminFamiPath({
        organizationId,
        formId: nextCycle?.formId,
        cycleId: nextCycleId,
        tab,
      }),
      { scroll: false },
    );
  }

  function handleSnapshotYearChange(year: number | null) {
    setSnapshotYearFilter(year);
    router.push(
      adminFamiPath({
        organizationId,
        formId: effectiveFormId,
        cycleId: effectiveCycle?.id,
        year,
        tab,
      }),
      { scroll: false },
    );
  }

  function handleTabChange(nextTab: TabId) {
    setTab(nextTab);
    router.push(
      adminFamiPath({
        organizationId,
        formId: effectiveFormId,
        cycleId: effectiveCycle?.id,
        year: snapshotYearFilter,
        tab: nextTab,
      }),
      { scroll: false },
    );
  }

  const snapshot = data?.snapshot;
  const preliminaryReferenceYear = snapshotYearFilter ?? (data?.latestVersionMeta?.createdAt ? getCalendarYearBrt(data.latestVersionMeta.createdAt) : currentBrtYear());
  const preliminary = useFamiPreliminary(effectiveCycle?.id, preliminaryReferenceYear);
  const ready = Boolean(effectiveCycle);
  const orgName = filters?.organizations.find((organization) => organization.id === organizationId)?.name ?? "";

  function handleExportCsv() {
    if (!snapshot || mode !== "admin") return;
    const csv = buildFamiCsv(snapshot);
    const scopeSlug = orgName || "organizacao";
    const processingSuffix = snapshot.processingVersion == null
      ? "processamento-nao-identificado"
      : processingFileToken(snapshot.processingVersion);
    downloadFamiCsv(csv, `fami-${scopeSlug}-${processingSuffix}.csv`);
  }

  const evolutionByYear = useMemo(() => data?.evolutionByYear ?? [], [data?.evolutionByYear]);
  const delta = useMemo(() => evolutionDeltaByYear(evolutionByYear), [evolutionByYear]);
  const queueScope = useMemo(
    () => ({ globalView: false, organizationId: organizationId || "" }),
    [organizationId],
  );

  function queueHref(
    segment: "evidencias" | "recomendacoes" | "plano-acao",
    params: Record<string, string>,
  ): string | null {
    if (mode !== "admin" || !organizationId || !effectiveFormId || !effectiveCycle) return null;
    return adminQueueSegmentHref(segment, queueScope, {
      ...params,
      cycleId: effectiveCycle.id,
    });
  }

  return (
    <section className={FAMI_SECTION_STACK}>
      {mode === "respondent" ? null : (
        <div className={ADMIN_PAGE_HERO_BLEED}>
          <AdminFamiMaturityHero
            loading={loading}
            reconciliationLoading={reconciliationLoading}
            ready={ready}
            exportDisabled={!snapshot}
            onRefresh={() => {
              void fetchSnapshot();
              void preliminary.reload();
            }}
            onExport={handleExportCsv}
            onReconcile={() => void handleReconciliation()}
          />
        </div>
      )}

      {filtersError ? (
        <AsyncErrorState
          title="Não foi possível carregar o escopo"
          message={filtersError}
          onRetry={fetchFilters}
        />
      ) : null}

      {cyclesError ? (
        <AsyncErrorState
          title="Não foi possível carregar os diagnósticos"
          message={cyclesError}
          onRetry={fetchCycles}
        />
      ) : null}

      {/* Guia metodológico — acima do seletor de diagnóstico (referência de página). */}
      <FamiMethodologyGuide currentLevel={snapshot?.global?.maturityLevel ?? null} />

      <PanelSection
        title="Diagnóstico"
        description="Organização, diagnóstico e ano. O ano vale para o processamento oficial e para o acompanhamento quadrimestral."
        variant="card"
        contentClassName="space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-2 md:gap-5">
          {mode === "admin" ? (
            <div className={`min-w-0 ${formSurface.fieldGroup}`}>
              <label htmlFor="fami-organization" className={formSurface.label}>
                Organização
              </label>
              <select
                id="fami-organization"
                value={organizationId}
                onChange={(event) => handleOrganizationChange(event.target.value)}
                className={formSurface.inputSelect}
              >
                <option value="">Selecione uma organização</option>
                {filters?.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={`min-w-0 ${formSurface.fieldGroup}`}>
              <p className={formSurface.label}>Organização</p>
              <div className={formSurface.readOnlyField}>
                {organizationId ? (
                  <span className="text-slate-800">
                    {filters?.organizations.find((organization) => organization.id === organizationId)?.name ?? "—"}
                  </span>
                ) : (
                  <span className="text-rose-600">Perfil sem organização vinculada.</span>
                )}
              </div>
            </div>
          )}

          <div className={`min-w-0 ${formSurface.fieldGroup}`}>
            <label htmlFor="fami-cycle" className={formSurface.label}>Diagnóstico com FAMI concluído</label>
            <select
              id="fami-cycle"
              value={cycleId}
              onChange={(event) => handleCycleChange(event.target.value)}
              className={formSurface.inputSelect}
              disabled={!organizationId || cycles.length === 0}
            >
              {cycles.length ? cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.formName} (v{cycle.formVersion}) · {cycle.periodLabel}
                </option>
              )) : <option value="">Nenhum diagnóstico com FAMI concluído disponível</option>}
            </select>
          </div>

          <YearSelect
            id="fami-snapshot-year-shell"
            label="Ano do processamento FAMI"
            hint="Vazio = situação atual (horário de Fortaleza, UTC−3). Também recorta o acompanhamento quadrimestral."
            years={data?.availableYears ?? []}
            value={snapshotYearFilter}
            onChange={handleSnapshotYearChange}
            disabled={loading || !effectiveCycle}
          />
        </div>
      </PanelSection>

      {snapshot?.integrityWarnings?.length ? (
        <div role="alert" aria-live="assertive" className={`${formSurface.messageWarning} space-y-2`}>
          <p className="font-semibold">O resultado histórico possui inconsistências de integridade.</p>
          {snapshot.integrityWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <FamiMaturitySectionBreak />

      {snapshotError ? (
        <AsyncErrorState
          title="Não foi possível carregar o Resultado FAMI"
          message={snapshotError}
          onRetry={fetchSnapshot}
          retrying={loading}
        />
      ) : null}

      <SegmentedTabs<TabId>
        size="lg"
        aria-label="Visões do FAMI"
        value={tab}
        onChange={handleTabChange}
        items={[
          { id: "resumo", label: "Panorama" },
          { id: "eixos", label: "Por eixo" },
          { id: "secoes", label: "Por seção" },
          { id: "evolucao", label: "Evolução" },
        ]}
      />

      {!ready ? (
        <div className={formSurface.empty.container}>
          <p className={formSurface.empty.title}>
            {mode === "respondent"
              ? "Selecione um diagnóstico"
              : !organizationId
                ? "Selecione uma organização"
                : "Selecione um diagnóstico"}
          </p>
          <p className={formSurface.empty.description}>
            {mode === "respondent"
              ? "Escolha um diagnóstico com Resultado FAMI disponível após a conclusão da validação."
              : !organizationId
                ? "Escolha a organização para listar os diagnósticos com Resultado FAMI concluído."
                : "Escolha um diagnóstico com processamento FAMI concluído para ver indicadores, eixos e evolução."}
          </p>
        </div>
      ) : loading ? (
        <div className={`${formSurface.nestedCard} animate-pulse px-5 py-10 text-sm text-slate-500 sm:px-6`}>
          Carregando indicadores…
        </div>
      ) : !snapshot ? (
        <div className={formSurface.empty.container}>
          <p className={formSurface.empty.title}>Resultado FAMI indisponível</p>
          <p className={formSurface.empty.description}>
            {snapshotYearFilter != null
              ? `Nenhum Resultado FAMI concluído em ${snapshotYearFilter}. Experimente “Todos os anos”.`
              : "Nenhum processamento FAMI encontrado para o diagnóstico selecionado."}{" "}
            {mode === "respondent"
              ? "O resultado fica disponível quando a administração conclui a validação do diagnóstico."
              : "Conclua a validação do diagnóstico para gerar o Resultado FAMI e as recomendações oficiais."}
          </p>
        </div>
      ) : tab === "resumo" && mode === "admin" ? (
        <FamiResumoAdminTab
          snapshot={snapshot}
          data={data}
          delta={delta}
          organizationId={organizationId}
          effectiveFormId={effectiveFormId}
          cycleId={effectiveCycle?.id ?? ""}
          queueScope={queueScope}
        />
      ) : tab === "resumo" ? (
        <FamiResumoBasicTab
          snapshot={snapshot}
          data={data}
          mode={mode}
          organizationId={organizationId}
          effectiveFormId={effectiveFormId}
          queueHref={queueHref}
        />
      ) : tab === "eixos" ? (
        <FamiEixosTab axes={snapshot.axes} />
      ) : tab === "secoes" ? (
        <FamiSecoesTab snapshot={snapshot} />
      ) : (
        <FamiEvolucaoTab
          data={data}
          cycleId={effectiveCycle?.id}
          referenceYear={preliminaryReferenceYear}
          canMaterialize={mode === "admin"}
          preliminary={preliminary}
        />
      )}
    </section>
  );
}
