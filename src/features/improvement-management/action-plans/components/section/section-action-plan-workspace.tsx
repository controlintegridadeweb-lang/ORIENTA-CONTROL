"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  ListChecks,
} from "lucide-react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import { listAllActionPlansForCycle } from "@/features/improvement-management/action-plans/client";
import {
  buildSectionActionPlanHierarchy,
  findSectionActionPlan,
  sectionActionPlanSourcesFromListItems,
  type SectionActionPlanGroup,
} from "@/features/improvement-management/action-plans/section-action-plan-model";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { PlanStatusBadge } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import {
  SectionPlanStatusBadge,
  sectionPlanStatusFromMetrics,
} from "@/features/improvement-management/action-plans/components/section/section-plan-status-badge";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { Skeleton } from "@/shared/ui/components/loading";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { PageHeader } from "@/shared/ui/components/page-header";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { UnderlineTabs } from "@/shared/ui/components/underline-tabs";
import { ContextTrail } from "@/shared/ui/components/context-trail";
import { AxisBadge } from "@/shared/ui/components/axis-badge";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import {
  respondentActionWorkspacePath,
  respondentSectionActionWorkspacePath,
  type RespondentSectionActionWorkspaceTab,
} from "@/shared/navigation/respondent-portfolio-paths";
import {
  adminPlanoAcaoDetailHref,
  adminSectionActionWorkspaceHref,
  type AdminSectionActionWorkspaceTab,
} from "@/shared/navigation/admin-paths";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { withRespondentReturnPath } from "@/shared/navigation/respondent-navigation-context";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { formatLocalDate } from "@/shared/datetime/business-date";

export type SectionActionPlanWorkspaceRole = "admin" | "respondent";
export type SectionActionPlanWorkspaceTab = "visao-geral" | "acoes" | "monitoramento";

type Props = {
  role: SectionActionPlanWorkspaceRole;
  sectionId: string;
  cycleId: string;
  activeTab: SectionActionPlanWorkspaceTab;
  returnTo?: string | null;
};

const TAB_LABELS: Record<SectionActionPlanWorkspaceTab, string> = {
  "visao-geral": "Visão geral",
  acoes: "Plano de ação",
  monitoramento: "Monitoramento",
};

function currentWorkspacePath(
  role: SectionActionPlanWorkspaceRole,
  section: SectionActionPlanGroup,
  tab: SectionActionPlanWorkspaceTab,
  returnTo?: string | null,
): string {
  if (role === "respondent") {
    return respondentSectionActionWorkspacePath(
      section.sectionId,
      section.cycleId,
      tab as RespondentSectionActionWorkspaceTab,
      { returnTo },
    );
  }
  return withAdminReturnPath(
    adminSectionActionWorkspaceHref(
      section.sectionId,
      section.cycleId,
      tab as AdminSectionActionWorkspaceTab,
    ),
    returnTo,
  );
}

function recommendationWorkspacePath(
  role: SectionActionPlanWorkspaceRole,
  recommendationId: string,
  tab: "acoes" | "monitoramento" | "visao-geral",
  returnPath: string,
): string {
  if (role === "respondent") {
    return withRespondentReturnPath(
      respondentActionWorkspacePath(recommendationId, tab),
      returnPath,
    );
  }
  return withAdminReturnPath(adminPlanoAcaoDetailHref(recommendationId, tab), returnPath);
}

function actionNumberInSection(
  section: SectionActionPlanGroup,
  recommendationIndex: number,
  actionIndex: number,
): number {
  const previousActions = section.recommendations
    .slice(0, recommendationIndex)
    .reduce((total, recommendation) => total + recommendation.actions.length, 0);
  return previousActions + actionIndex + 1;
}

function SectionWorkspaceSkeleton() {
  return (
    <div className={layout.pageStack} role="status" aria-label="Carregando plano da seção">
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-30 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

function SectionOverview({ section }: { section: SectionActionPlanGroup }) {
  const axisTheme = getAxisTheme(section.axisName);
  return (
    <div className={layout.panelStack}>
      <div className={layout.kpiGrid4}>
        <MetricCard
          density="compact"
          variant="info"
          label="Recomendações"
          value={section.recommendations.length}
          icon={FileText}
          accentColor={axisTheme.primary}
        />
        <MetricCard
          density="compact"
          label="Ações"
          value={section.metrics.totalActions}
          icon={ListChecks}
          accentColor={axisTheme.primary}
        />
        <MetricCard
          density="compact"
          variant="success"
          label="Concluídas"
          value={section.metrics.completedActions}
          icon={CheckCircle2}
        />
        <MetricCard
          density="compact"
          variant={section.metrics.overdueActions > 0 ? "danger" : "neutral"}
          label="Em atraso"
          value={section.metrics.overdueActions}
          icon={Clock3}
        />
      </div>

      <PanelSection
        title="Encadeamento da seção"
        description="A execução é lida do nível mais específico para o mais amplo, sem perder a origem de cada ação."
        variant="card"
      >
        <ol className="grid overflow-hidden rounded-lg bg-slate-50/80 md:grid-cols-3 md:divide-x md:divide-slate-200">
          {[
            ["Ações", `${section.metrics.totalActions} registradas`],
            ["Plano da seção", `${section.metrics.progressPercentage}% executado`],
            ["Eixo", section.axisName],
          ].map(([title, detail], index) => (
            <li
              key={title}
              className="flex min-w-0 items-start gap-3 border-t border-slate-200 p-4 first:border-t-0 md:border-t-0"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                style={{
                  borderColor: axisTheme.border,
                  backgroundColor: axisTheme.softBackground,
                  color: axisTheme.text,
                }}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className={typography.cardTitle}>{title}</p>
                <p className={`mt-1 ${typography.cardDescription}`}>{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </PanelSection>

      <PanelSection
        title="Recomendações de origem"
        description="As recomendações justificam as intervenções; o plano da seção consolida a execução."
        variant="plain"
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {section.recommendations.map((recommendation, index) => (
            <article
              key={recommendation.recommendationId}
              className="border-t border-slate-100 p-5 first:border-t-0 sm:p-6"
            >
              <p className={typography.contextLabel}>
                Recomendação {section.sectionDisplayNumber}.{index + 1}
              </p>
              <h3 className={`mt-1.5 ${typography.cardTitle}`}>{recommendation.recommendationText}</h3>
              <div className="mt-4 border-l-2 border-slate-200 pl-3">
                <p className={typography.meta}>Pergunta de origem</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{recommendation.questionPrompt}</p>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-500">
                {recommendation.actions.length}{" "}
                {recommendation.actions.length === 1 ? "ação vinculada" : "ações vinculadas"}
              </p>
            </article>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}

function SectionActions({
  role,
  section,
  parentReturnTo,
}: {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
  parentReturnTo?: string | null;
}) {
  const returnPath = currentWorkspacePath(role, section, "acoes", parentReturnTo);
  const sectionStatus = sectionPlanStatusFromMetrics(section.metrics);

  return (
    <div className={layout.panelStack}>
      <PanelSection
        title="Execução da seção"
        description="O percentual consolida apenas as ações ativas desta seção."
        actions={<SectionPlanStatusBadge status={sectionStatus} />}
        variant="card"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <p className={typography.contextLabel}>Progresso consolidado</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">
              {section.metrics.progressPercentage}%
            </p>
          </div>
          <div className="w-full sm:w-72">
            <AdminActionPlanProgress value={section.metrics.progressPercentage} size="md" showLabel={false} />
          </div>
        </div>
      </PanelSection>

      {section.recommendations.map((recommendation, recommendationIndex) => (
        <section key={recommendation.recommendationId} className="space-y-3">
          <div className="border-l-2 border-slate-200 pl-4">
            <p className={typography.contextLabel}>
              Origem {section.sectionDisplayNumber}.{recommendationIndex + 1}
            </p>
            <h2 className={`mt-1 ${typography.subsectionTitle}`}>{recommendation.recommendationText}</h2>
          </div>

          {recommendation.actions.length === 0 ? (
            <div className={`${formSurface.messageNeutral} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <span>Esta recomendação ainda não possui ação cadastrada.</span>
              {role === "respondent" ? (
                <Link
                  className={`${formSurface.secondaryButtonSm} shrink-0`}
                  href={recommendationWorkspacePath(role, recommendation.recommendationId, "acoes", returnPath)}
                >
                  Cadastrar ação
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {recommendation.actions.map((action, actionIndex) => (
                <article key={action.id} className={`${formSurface.entityListCard} p-5 sm:p-6`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className={typography.contextLabel}>
                        Ação A{actionNumberInSection(section, recommendationIndex, actionIndex)}
                      </p>
                      <h3 className={`mt-1.5 ${typography.cardTitle}`}>{action.actionText}</h3>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className={typography.meta}>Responsável</dt>
                          <dd className="mt-0.5 text-slate-700">{action.responsibleName || "Não informado"}</dd>
                        </div>
                        <div>
                          <dt className={typography.meta}>Prazo</dt>
                          <dd className="mt-0.5 text-slate-700">{formatLocalDate(action.dueDate)}</dd>
                        </div>
                      </dl>
                    </div>
                    <PlanStatusBadge status={action.status} />
                  </div>
                  <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <AdminActionPlanProgress
                      value={action.progressPercentage}
                      overdue={action.slaLabel === "overdue"}
                    />
                    <Link
                      className={formSurface.secondaryButtonSm}
                      href={recommendationWorkspacePath(role, recommendation.recommendationId, "acoes", returnPath)}
                    >
                      {role === "respondent" ? "Gerenciar ação" : "Ver ação"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function SectionMonitoring({
  role,
  section,
  parentReturnTo,
}: {
  role: SectionActionPlanWorkspaceRole;
  section: SectionActionPlanGroup;
  parentReturnTo?: string | null;
}) {
  const returnPath = currentWorkspacePath(role, section, "monitoramento", parentReturnTo);
  return (
    <div className={layout.panelStack}>
      <div className={layout.kpiGrid3}>
        <MetricCard
          density="compact"
          variant="info"
          label="Execução"
          value={`${section.metrics.progressPercentage}%`}
        />
        <MetricCard
          density="compact"
          variant="success"
          label="Concluídas"
          value={section.metrics.completedActions}
        />
        <MetricCard
          density="compact"
          variant={section.metrics.overdueActions > 0 ? "danger" : "neutral"}
          label="Em atraso"
          value={section.metrics.overdueActions}
        />
      </div>

      <PanelSection
        title="Supervisão por ação"
        description="Comprovações, decisões e histórico permanecem vinculados à ação e à recomendação de origem."
        variant="plain"
      >
        {section.actions.length === 0 ? (
          <EmptyState
            title="Não há ações para monitorar nesta seção"
            description="O monitoramento ficará disponível quando houver ações cadastradas."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {section.recommendations.flatMap((recommendation, recommendationIndex) =>
              recommendation.actions.map((action, actionIndex) => (
                <article
                  key={action.id}
                  className="flex flex-col gap-4 border-t border-slate-100 p-5 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className={typography.contextLabel}>
                      Ação A{actionNumberInSection(section, recommendationIndex, actionIndex)}
                    </p>
                    <h3 className={`mt-1 ${typography.cardTitle}`}>{action.actionText}</h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      Origem: {recommendation.recommendationText}
                    </p>
                  </div>
                  <Link
                    className={`${formSurface.secondaryButtonSm} shrink-0`}
                    href={recommendationWorkspacePath(role, recommendation.recommendationId, "monitoramento", returnPath)}
                  >
                    Abrir monitoramento
                  </Link>
                </article>
              )),
            )}
          </div>
        )}
      </PanelSection>
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
    void load();
  }, [load]);

  const listFallback =
    role === "respondent" ? "/respondente/portfolio-recomendacoes?view=action-plan" : "/admin/plano-acao";
  const backPath = returnTo || listFallback;
  const tabs = useMemo(() => {
    if (!section) return [];
    return (Object.keys(TAB_LABELS) as SectionActionPlanWorkspaceTab[]).map((tab) => ({
      label: TAB_LABELS[tab],
      href: currentWorkspacePath(role, section, tab, returnTo),
      active: tab === activeTab,
    }));
  }, [activeTab, role, section, returnTo]);

  if (loading && !section) return <SectionWorkspaceSkeleton />;
  if (error) {
    return (
      <AsyncErrorState
        title="Não foi possível carregar o Plano de ação da seção"
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
        title="Seção sem plano de ação neste diagnóstico"
        description="Não foram encontradas recomendações do ciclo atual vinculadas a esta seção."
        action={
          <Link href={backPath} className={formSurface.secondaryButtonSm}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </Link>
        }
      />
    );
  }

  const sectionStatus = sectionPlanStatusFromMetrics(section.metrics);

  return (
    <div className={`${layout.pageStack} max-w-7xl`}>
      <div className="space-y-4">
        <Link href={backPath} className={typography.inlineNavLink}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao Plano de ação
        </Link>

        <ContextTrail
          items={[
            { label: `${section.formName} · ${section.periodLabel}` },
            { label: `Eixo ${section.axisName}` },
            { label: `Seção ${section.sectionDisplayNumber}` },
          ]}
        />

        <PageHeader
          title={section.sectionName}
          kicker={<AxisBadge axisName={section.axisName} />}
          description="Plano de ação consolidado da seção, com origem rastreável nas recomendações do diagnóstico."
          actions={<SectionPlanStatusBadge status={sectionStatus} />}
          size="compact"
          className="mb-0"
        />
      </div>

      <UnderlineTabs tabs={tabs} aria-label="Plano de ação da seção" />

      {activeTab === "visao-geral" ? <SectionOverview section={section} /> : null}
      {activeTab === "acoes" ? (
        <SectionActions role={role} section={section} parentReturnTo={returnTo} />
      ) : null}
      {activeTab === "monitoramento" ? (
        <SectionMonitoring role={role} section={section} parentReturnTo={returnTo} />
      ) : null}
    </div>
  );
}
