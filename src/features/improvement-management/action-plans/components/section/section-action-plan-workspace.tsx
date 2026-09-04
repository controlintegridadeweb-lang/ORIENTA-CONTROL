"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, CircleAlert } from "lucide-react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import { listAllActionPlansForCycle } from "@/features/improvement-management/action-plans/client";
import {
  buildSectionActionPlanHierarchy,
  findSectionActionPlan,
  sectionActionPlanSourcesFromListItems,
  type SectionActionPlanGroup,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import { SectionWorkspaceOverview } from "@/features/improvement-management/action-plans/components/section/section-workspace-overview";
import { SectionProblemSolutionTree } from "@/features/improvement-management/action-plans/components/section/section-problem-solution-tree";
import { SectionWorkspaceActions } from "@/features/improvement-management/action-plans/components/section/section-workspace-actions";
import { SectionWorkspaceMonitoring } from "@/features/improvement-management/action-plans/components/section/section-workspace-monitoring";
import {
  currentSectionWorkspacePath,
  SECTION_WORKSPACE_TAB_LABELS,
  SECTION_WORKSPACE_TAB_ORDER,
  type SectionActionPlanWorkspaceRole,
  type SectionActionPlanWorkspaceTab,
} from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { RecommendationDetailTabs } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-tabs";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { Skeleton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import { adminReturnLabel } from "@/shared/navigation/admin-navigation-context";
import { respondentReturnLabel } from "@/shared/navigation/respondent-navigation-context";

export type { SectionActionPlanWorkspaceRole, SectionActionPlanWorkspaceTab };

type Props = {
  role: SectionActionPlanWorkspaceRole;
  sectionId: string;
  cycleId: string;
  activeTab: SectionActionPlanWorkspaceTab;
  returnTo?: string | null;
};

function SectionWorkspaceSkeleton() {
  return (
    <div className={`${layout.pageStack} gap-6 max-w-6xl`} role="status" aria-label="Carregando plano da seção">
      <div className="space-y-4 border-b border-slate-100 pb-6">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function toSection(
  items: ActionPlanListItem[],
  cycleId: string,
  sectionId: string,
): SectionActionPlanGroup | null {
  const hierarchy = buildSectionActionPlanHierarchy(sectionActionPlanSourcesFromListItems(items));
  return findSectionActionPlan(hierarchy, cycleId, sectionId);
}

export function SectionActionPlanWorkspace({
  role,
  sectionId,
  cycleId,
  activeTab,
  returnTo,
}: Props) {
  const [section, setSection] = useState<SectionActionPlanGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listAllActionPlansForCycle(role, cycleId);
      setSection(toSection(items, cycleId, sectionId));
    } catch (loadError) {
      setSection(null);
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o plano da seção.");
    } finally {
      setLoading(false);
    }
  }, [cycleId, role, sectionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void load();
  }, [load]);

  const listFallback =
    role === "respondent" ? "/respondente/portfolio-recomendacoes" : "/admin/plano-acao";
  const backPath = returnTo || listFallback;
  const backLabel = role === "admin" ? adminReturnLabel(backPath) : respondentReturnLabel(backPath);
  const tabs = useMemo(() => {
    if (!section) return [];
    return SECTION_WORKSPACE_TAB_ORDER.map((tab) => ({
      label: SECTION_WORKSPACE_TAB_LABELS[tab],
      href: currentSectionWorkspacePath(role, section, tab),
    }));
  }, [role, section]);

  if (loading && !section) return <SectionWorkspaceSkeleton />;
  if (error) {
    return (
      <AsyncErrorState
        title="Não foi possível carregar o Plano de integridade e compliance da seção"
        message={error}
        onRetry={load}
        retrying={loading}
      />
    );
  }
  if (!section) {
    return (
      <EmptyState
        icon={CircleAlert}
        iconWrapClassName="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700"
        title="Seção sem plano de integridade e compliance neste diagnóstico"
        description="Não foram encontradas recomendações do ciclo atual vinculadas a esta seção."
        action={
          <Link href={backPath} className={formSurface.secondaryButtonSm}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Voltar
          </Link>
        }
      />
    );
  }

  const sectionStatus = sectionPlanStatusFromMetrics(section.metrics);
  const maxWidth = role === "admin" ? "max-w-7xl" : "max-w-6xl";

  return (
    <div className={`${layout.pageStack} gap-6 ${maxWidth}`}>
      <header className="space-y-4 border-b border-slate-100 pb-6">
        <Link
          href={backPath}
          className={`inline-flex items-center gap-1 ${typography.inlineNavLink} text-sm font-medium`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>

        <div className="space-y-2">
          <h1 className={typography.pageTitle}>Detalhes da seção</h1>
          <SectionPlanStatusBadge status={sectionStatus} />
        </div>
      </header>

      <RecommendationDetailTabs tabs={tabs} aria-label="Seções do workspace" />

      {activeTab === "visao-geral" ? <SectionWorkspaceOverview section={section} /> : null}
      {activeTab === "problemas-solucoes" ? <SectionProblemSolutionTree section={section} /> : null}
      {activeTab === "acoes" ? (
        <SectionWorkspaceActions role={role} section={section} parentReturnTo={returnTo} />
      ) : null}
      {activeTab === "monitoramento" ? (
        <SectionWorkspaceMonitoring role={role} section={section} parentReturnTo={returnTo} />
      ) : null}
    </div>
  );
}
