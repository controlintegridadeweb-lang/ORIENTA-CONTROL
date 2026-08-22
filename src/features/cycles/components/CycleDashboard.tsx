"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { PanelSection } from "@/shared/ui/components/panel-section";
import {
  AdminListScopeBanner,
  type AdminListScopePart,
} from "@/shared/ui/admin/admin-list-scope-banner";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import type { CycleState } from "@/shared/domain/types";
import {
  groupByState,
  isResponseDeadlineOverdue,
  type CollectionFilter,
  type DueFilter,
} from "@/features/cycles/dashboard-model";
import { currentAdminListPath } from "@/shared/navigation/admin-navigation-context";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import { StateColumn } from "./StateColumn";
import { downloadReportBundle, runCycleLifecycleBatch } from "@/application/automation/client";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { CycleBulkActions, type CycleBulkAction } from "./cycle-bulk-actions";
import { CycleDashboardFilters } from "./cycle-dashboard-filters";
import type {
  CycleDashboardFormScope,
  CycleDashboardInitialFilters,
  CycleDashboardOrganizationOption,
  CycleDashboardPeriodOption,
  CycleDashboardPeriodScope,
} from "./cycle-dashboard-contracts";

export type { CycleDashboardInitialFilters } from "./cycle-dashboard-contracts";

type FormScope = CycleDashboardFormScope;
type OrganizationOption = CycleDashboardOrganizationOption;
type CycleMetrics = { linked: number; visible: number; overdue: number };

function buildCycleDashboardParams(input: {
  formId: string;
  search: string;
  organizationId: string;
  state: CycleState | "";
  dueFilter: DueFilter;
  collectionFilter: CollectionFilter;
  periodId?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (input.formId) params.set("formId", input.formId);
  if (input.search.trim()) params.set("q", input.search.trim());
  if (input.organizationId) params.set("organizationId", input.organizationId);
  if (input.state) params.set("state", input.state);
  if (input.dueFilter !== "all") params.set("due", input.dueFilter);
  if (input.collectionFilter !== "all") {
    params.set("collection", input.collectionFilter);
  }
  if (input.periodId) params.set("periodId", input.periodId);
  return params;
}

export function CycleDashboard({
  cycles,
  metrics,
  forms,
  organizations,
  formScope = null,
  periodScope = null,
  periodOptions = [],
  periodBaseDeadlineAt = null,
  requireFormSelection = false,
  initialFilters = {},
  readyToFinalizeCycleIds = [],
}: {
  cycles: CycleListItem[];
  metrics: CycleMetrics;
  forms: FormScope[];
  organizations: OrganizationOption[];
  /** Mantidos por compatibilidade com a rota; a visão por órgão não pagina. */
  page?: number;
  pageSize?: number;
  totalPages?: number;
  formScope?: FormScope | null;
  periodScope?: CycleDashboardPeriodScope | null;
  periodOptions?: CycleDashboardPeriodOption[];
  periodBaseDeadlineAt?: string | null;
  requireFormSelection?: boolean;
  initialFilters?: CycleDashboardInitialFilters;
  /** Diagnósticos em validação que passaram pelas mesmas pré-condições do banco. */
  readyToFinalizeCycleIds?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipFirstSync = useRef(true);

  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [formId, setFormId] = useState(formScope?.id ?? "");
  const [organizationId, setOrganizationId] = useState(initialFilters.organizationId ?? "");
  const [state, setState] = useState<CycleState | "">(initialFilters.state ?? "");
  const [dueFilter, setDueFilter] = useState<DueFilter>(initialFilters.dueFilter ?? "all");
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    initialFilters.collectionFilter ?? "all",
  );
  const [pendingBulkAction, setPendingBulkAction] = useState<CycleBulkAction | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const effectiveFormId = formScope?.id ?? formId;

  const params = useMemo(
    () =>
      buildCycleDashboardParams({
        formId: effectiveFormId,
        search,
        organizationId,
        state,
        dueFilter,
        collectionFilter,
        periodId: periodScope?.id,
      }),
    [
      collectionFilter,
      dueFilter,
      effectiveFormId,
      organizationId,
      periodScope?.id,
      search,
      state,
    ],
  );
  const currentListPath = currentAdminListPath(pathname, params.toString());

  useEffect(() => {
    if (skipFirstSync.current) {
      skipFirstSync.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const next = params.toString();
      const currentWithoutPage = new URLSearchParams(searchParams);
      currentWithoutPage.delete("page");
      if (next === currentWithoutPage.toString()) return;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [params, pathname, router, searchParams]);

  const { groups, overdueSet } = useMemo(() => {
    const now = new Date();
    const overdue = new Set<string>();
    for (const cycle of cycles) {
      if (isResponseDeadlineOverdue(cycle, now)) overdue.add(cycle.id);
    }
    return { groups: groupByState(cycles), overdueSet: overdue };
  }, [cycles]);

  const showPeriodOnCards = !periodScope && periodOptions.length > 1;

  const validationCycles = cycles.filter(
    (cycle) => cycle.state === "in_validation",
  );
  const readyToFinalizeSet = new Set(readyToFinalizeCycleIds);
  const eligibleForFinalization = validationCycles.filter((cycle) =>
    readyToFinalizeSet.has(cycle.id),
  );
  const eligibleForClosing = cycles.filter((cycle) => cycle.state === "validated");
  const eligibleForReports = cycles.filter((cycle) => cycle.state === "completed");

  const hasSecondaryFilters = Boolean(
    search ||
      organizationId ||
      state ||
      dueFilter !== "all" ||
      collectionFilter !== "all" ||
      Boolean(periodScope),
  );

  function eligibleCycles(action: CycleBulkAction) {
    if (action === "finalize_validation") return eligibleForFinalization;
    if (action === "close_cycle") return eligibleForClosing;
    return eligibleForReports;
  }

  async function executeBulkAction() {
    if (!pendingBulkAction) return;
    const selected = eligibleCycles(pendingBulkAction);
    if (selected.length === 0) return;
    setBulkRunning(true);
    setBulkResult(null);
    try {
      if (pendingBulkAction === "reports") {
        await downloadReportBundle(selected.map((cycle) => cycle.id));
        setBulkResult(`${selected.length} relatório(s) foram preparados no pacote.`);
      } else {
        const result = await runCycleLifecycleBatch(
          pendingBulkAction,
          selected.map((cycle) => cycle.id),
        );
        setBulkResult(
          `${result.succeeded.length} concluído(s), ${result.skipped.length} preservado(s) e ${result.failed.length} falha(s).`,
        );
        router.refresh();
      }
      notify.success("Operação em lote concluída.");
      setPendingBulkAction(null);
    } catch (caught) {
      notify.error(describeError(caught, "Não foi possível executar a operação em lote."));
    } finally {
      setBulkRunning(false);
    }
  }

  function clearSecondaryFilters() {
    setSearch("");
    setOrganizationId("");
    setState("");
    setDueFilter("all");
    setCollectionFilter("all");
  }

  const scopeParts = useMemo((): AdminListScopePart[] => {
    const parts: AdminListScopePart[] = [];
    if (formScope) {
      parts.push({
        label: "Formulário",
        value: formScope.name,
        onClear: () => router.push("/admin/ciclos"),
      });
    }
    if (periodScope) {
      parts.push({
        label: "Período",
        value: periodScope.label,
        onClear: () =>
          router.push(
            formScope ? `/admin/ciclos?formId=${encodeURIComponent(formScope.id)}` : "/admin/ciclos",
          ),
      });
    } else if (formScope && periodOptions.length === 1) {
      parts.push({
        label: "Período",
        value: periodOptions[0]!.label,
      });
    } else if (formScope && periodOptions.length > 1) {
      parts.push({
        label: "Período",
        value: "Mais recente de cada órgão",
      });
    }
    return parts;
  }, [formScope, periodOptions, periodScope, router]);

  return (
    <div className={`${layout.panelStack} pt-1`}>
      <CycleDashboardFilters
        formScope={formScope}
        periodScope={periodScope}
        periodOptions={periodOptions}
        periodBaseDeadlineAt={periodBaseDeadlineAt}
        forms={forms}
        organizations={organizations}
        formId={formId}
        search={search}
        organizationId={organizationId}
        state={state}
        dueFilter={dueFilter}
        collectionFilter={collectionFilter}
        requireFormSelection={requireFormSelection}
        hasSecondaryFilters={hasSecondaryFilters}
        currentListPath={currentListPath}
        onFormChange={setFormId}
        onSearchChange={setSearch}
        onOrganizationChange={setOrganizationId}
        onStateChange={setState}
        onDueFilterChange={setDueFilter}
        onCollectionFilterChange={setCollectionFilter}
        onPeriodChange={(nextPeriodId) => {
          const next = new URLSearchParams(params);
          if (nextPeriodId) next.set("periodId", nextPeriodId);
          else next.delete("periodId");
          next.delete("periodLabel");
          router.push(next.toString() ? `${pathname}?${next}` : pathname);
        }}
        onClear={clearSecondaryFilters}
      />

      {requireFormSelection ? (
        <FormSelectionEmptyState />
      ) : (
        <>
          <PanelSection
            title="Indicadores"
            description={
              formScope
                ? `Órgãos no formulário ${formScope.name}, na situação atual de cada um.`
                : "Órgãos no formulário selecionado."
            }
            variant="plain"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:max-w-4xl">
              <MetricCard
                density="compact"
                variant="neutral"
                label="Órgãos vinculados"
                value={metrics.linked}
                htmlTitle="Total de órgãos vinculados ao formulário e período selecionados, sem considerar os filtros de exibição"
              />
              <MetricCard
                density="compact"
                variant="neutral"
                label="Órgãos exibidos"
                value={metrics.visible}
                htmlTitle="Órgãos que correspondem aos filtros atuais"
              />
              <MetricCard
                density="compact"
                variant={metrics.overdue > 0 ? "danger" : "neutral"}
                label="Com prazo vencido"
                value={metrics.overdue}
                htmlTitle="Órgãos com prazo ultrapassado e ainda sob responsabilidade do respondente"
                onClick={() => setDueFilter(dueFilter === "overdue" ? "all" : "overdue")}
                aria-pressed={dueFilter === "overdue"}
                selected={dueFilter === "overdue"}
              />
            </div>
          </PanelSection>

          <AdminListScopeBanner parts={scopeParts} />

          {cycles.length > 0 ? (
            <CycleBulkActions
              visibleCount={cycles.length}
              validationCount={validationCycles.length}
              finalizationCount={eligibleForFinalization.length}
              closingCount={eligibleForClosing.length}
              reportsCount={eligibleForReports.length}
              pendingAction={pendingBulkAction}
              pendingCount={pendingBulkAction ? eligibleCycles(pendingBulkAction).length : 0}
              running={bulkRunning}
              result={bulkResult}
              onSelect={setPendingBulkAction}
              onConfirm={executeBulkAction}
              onCancel={() => setPendingBulkAction(null)}
            />
          ) : null}

          {cycles.length === 0 ? (
            <EmptyState filtered={hasSecondaryFilters} onClear={clearSecondaryFilters} />
          ) : (
            <section aria-label="Situação dos órgãos por etapa" className={formSurface.kanban.board}>
              <div className={formSurface.kanban.boardInner}>
                <div className={formSurface.kanban.columnsRow}>
                  {groups.map((group) => (
                    <StateColumn
                      key={group.state}
                      group={group}
                      isOverdue={(id) => overdueSet.has(id)}
                      detailReturnTo={currentListPath}
                      showPeriodOnCards={showPeriodOnCards}
                      periodBaseDeadlineAt={periodBaseDeadlineAt}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function FormSelectionEmptyState() {
  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <ClipboardList className="h-6 w-6" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>Selecione um formulário</p>
      <p className={formSurface.empty.description}>
        Selecione um formulário para visualizar a situação dos órgãos.
      </p>
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered?: boolean; onClear?: () => void }) {
  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <ClipboardList className="h-6 w-6" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>
        {filtered
          ? "Nenhum órgão encontrado com os filtros atuais"
          : "Nenhum órgão vinculado a este formulário"}
      </p>
      <p className={formSurface.empty.description}>
        {filtered
          ? "Ajuste os filtros para localizar outro órgão."
          : "Crie um diagnóstico para vincular órgãos a este formulário."}
      </p>
      {filtered ? (
        <button type="button" onClick={onClear} className={formSurface.secondaryButtonSm}>
          Limpar filtros
        </button>
      ) : (
        <Link href="/admin/ciclos/novo" className={formSurface.primaryButtonSm}>
          Criar diagnóstico
        </Link>
      )}
    </div>
  );
}
