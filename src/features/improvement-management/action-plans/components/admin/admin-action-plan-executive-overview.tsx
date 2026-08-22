"use client";

import Link from "next/link";
import { countLabel } from "@/shared/format/count-label";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { computeActionPlanMetrics } from "@/features/improvement-management/action-plans/plan-metrics";
import { PLAN_PROGRESS_CALCULATION_HINT } from "@/features/improvement-management/recommendations/respondent-presentation";
import { recommendationTypeLabel } from "@/shared/ui/status-registry";
import { adminPlanoAcaoDetailHref } from "@/shared/navigation/admin-paths";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import { useRecommendationDetailContext } from "@/features/improvement-management/recommendations/components/hub/recommendation-detail-context";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { describeError } from "@/infrastructure/notifications/notify";
import { getAdminRecommendationActionPlanCompletionReadiness } from "@/features/improvement-management/action-plans/client";
import type {
  ActionPlanCompletionBlock,
  ActionPlanCompletionReadiness,
} from "@/features/improvement-management/action-plans/completion-readiness-model";
import {
  adminReturnPathOrFallback,
  withAdminReturnPath,
} from "@/shared/navigation/admin-navigation-context";

const PANEL = `${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`;

function completionBlockLabel(block: ActionPlanCompletionBlock): string {
  const base = (() => {
    switch (block.reason) {
      case "exception_pending":
        return "Solicitação de exceção ainda pendente";
      case "missing_active_action":
        return "Recomendação sem ação ativa";
      case "action_not_completed":
        return "Ação ainda não concluída";
      case "open_supervision_request":
        return "Solicitação de supervisão ainda aberta";
      case "missing_execution_evidence":
        return "Ação concluída sem comprovação válida na revisão atual";
      case "action_not_approved":
        return "Ação concluída sem aceite administrativo vigente";
    }
  })();
  return block.actionLabel ? `${base}: ${block.actionLabel}` : base;
}

function buildInstitutionalSummary(
  progress: number,
  stats: {
    overdue: number;
    noResp: number;
    completed: number;
    total: number;
    active: number;
  },
  hasPlan: boolean,
): string {
  if (!hasPlan || stats.total === 0) {
    return "Ainda não há ação cadastrada para esta recomendação. Quando criada, ela passará a compor o plano de ação da seção; acompanhe a evolução e registre orientações na supervisão quando necessário.";
  }
  if (stats.active > 0 && stats.completed === stats.active) {
    return "Plano concluído pela organização. Revise entregas e evidências antes de encerrar a avaliação.";
  }
  if (stats.overdue > 0) {
    return `Execução em andamento com ${countLabel(stats.overdue, "ação em atraso", "ações em atraso")} — requer acompanhamento gerencial.`;
  }
  if (progress < 40) {
    return `Plano iniciado (${progress}% de progresso). A organização está estruturando a execução.`;
  }
  return `Execução em curso (${progress}% de progresso).`;
}

/** Resumo executivo do plano — primeira aba do workspace de supervisão (admin). */
export function AdminActionPlanExecutiveOverview() {
  const ctx = useRecommendationDetailContext();
  const row = ctx.row;
  const adminItem = ctx.adminItem;
  const searchParams = useSearchParams();
  const [completionReadiness, setCompletionReadiness] =
    useState<ActionPlanCompletionReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  const loadCompletionReadiness = useCallback(async () => {
    if (!row?.recommendationId) return;
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      const next = await getAdminRecommendationActionPlanCompletionReadiness(
        row.recommendationId,
      );
      setCompletionReadiness(next);
    } catch (caught) {
      setCompletionReadiness(null);
      setReadinessError(
        describeError(caught, "Não foi possível verificar os bloqueios reais do encerramento."),
      );
    } finally {
      setReadinessLoading(false);
    }
  }, [row?.recommendationId]);

  useEffect(() => {
    void loadCompletionReadiness();
  }, [loadCompletionReadiness]);

  const plans = useMemo(() => row?.plans ?? [], [row?.plans]);
  const stats = useMemo(() => computeActionPlanMetrics(plans), [plans]);
  const progress = stats.progress;

  if (!row || !adminItem) return null;

  const returnTo = adminReturnPathOrFallback(
    searchParams.get("returnTo"),
    "/admin/plano-acao",
  );
  const acoesHref = withAdminReturnPath(
    adminPlanoAcaoDetailHref(row.recommendationId, "acoes"),
    returnTo,
  );
  const monitoramentoHref = withAdminReturnPath(
    adminPlanoAcaoDetailHref(row.recommendationId, "monitoramento"),
    returnTo,
  );
  const overdue = adminItem.isOverdue;

  const summaryText = buildInstitutionalSummary(progress, stats, adminItem.hasPlan);
  const pendingCount = Math.max(0, stats.active - stats.completed);
  const fieldLabel = typography.fieldLabel;

  return (
    <div className={layout.panelStack}>
      <PanelSection
        title="Resumo do plano"
        description="Progresso consolidado e dados institucionais da execução."
        variant="plain"
        actions={
          <div className="text-right">
            <p className={typography.metricLabel}>Progresso consolidado</p>
            <p className={`mt-1.5 ${typography.metricValueCompact}`}>{progress}%</p>
          </div>
        }
      >
        <div className={`${PANEL} space-y-4`}>
          <AdminActionPlanProgress value={progress} overdue={overdue} size="sm" showLabel={false} />
          <p className="text-xs leading-relaxed text-slate-600">{PLAN_PROGRESS_CALCULATION_HINT}</p>

          <dl className="grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className={fieldLabel}>Organização</dt>
              <dd className="mt-0.5 text-slate-800">{row.organizationName}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Formulário</dt>
              <dd className="mt-0.5 text-slate-800">
                {row.formName}
                <span className="tabular-nums text-slate-400"> v{adminItem.formVersion}</span>
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Eixo</dt>
              <dd className="mt-0.5 text-slate-800">{row.axisName || "—"}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Início</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatLocalDate(adminItem.startDate)}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Final</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatLocalDate(adminItem.dueDate)}
                {overdue ? (
                  <span className="ml-1.5 text-xs font-semibold text-rose-700">Atrasado</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Responsável</dt>
              <dd className="mt-0.5 text-slate-800">
                {adminItem.responsibleName || "Não definido"}
              </dd>
            </div>
          </dl>
        </div>
      </PanelSection>

      <PanelSection
        title="Indicadores"
        description="Panorama consolidado do progresso e da situação das ações."
        variant="plain"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            variant="neutral"
            density="compact"
            label="Total de ações"
            value={stats.total}
            secondary={countLabel(stats.completed, "concluída", "concluídas")}
          />
          <MetricCard
            variant={stats.overdue > 0 ? "danger" : "neutral"}
            density="compact"
            label="Atrasadas"
            value={stats.overdue}
            secondary={stats.overdue > 0 ? "Exigem supervisão" : undefined}
            status={stats.overdue > 0 ? "critical" : undefined}
          />
          <MetricCard
            variant={pendingCount > 0 ? "warning" : "success"}
            density="compact"
            label="Em execução"
            value={pendingCount}
            secondary={pendingCount > 0 ? "Ainda não concluídas" : "Nenhuma ação em execução"}
            status={pendingCount > 0 ? "attention" : "neutral"}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Situação do plano"
        description="Leitura gerencial — bloqueios e próximos passos."
        variant="plain"
      >
        <div className={`${PANEL} space-y-4`}>
          <p className="text-sm leading-relaxed text-slate-700">{summaryText}</p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={formSurface.label}>Bloqueios reais de encerramento</p>
              {readinessError ? (
                <button
                  type="button"
                  className={formSurface.ghostButton}
                  onClick={() => void loadCompletionReadiness()}
                  disabled={readinessLoading}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tentar novamente
                </button>
              ) : null}
            </div>
            {readinessLoading ? (
              <p className="mt-1 text-sm text-slate-600">Verificando regras de encerramento…</p>
            ) : readinessError ? (
              <p role="alert" className="mt-1 text-sm text-rose-700">{readinessError}</p>
            ) : completionReadiness?.blocks.length ? (
              <ul className="mt-2 space-y-1.5">
                {completionReadiness.blocks.map((block, index) => (
                  <li
                    key={`${block.reason}:${block.actionPlanId ?? "recommendation"}:${index}`}
                    className="flex items-start gap-2 text-sm text-amber-950"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                      aria-hidden
                    />
                    {completionBlockLabel(block)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                Nenhum bloqueio de encerramento identificado.
              </p>
            )}
          </div>

          {stats.overdue > 0 || stats.noResp > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <p className={formSurface.label}>Alertas operacionais</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {stats.overdue > 0 ? (
                  <li>{countLabel(stats.overdue, "ação com final vencido", "ações com final vencido")}</li>
                ) : null}
                {stats.noResp > 0 ? (
                  <li>{countLabel(stats.noResp, "ação sem responsável definido", "ações sem responsável definido")}</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            <Link
              href={acoesHref}
              className={`${formSurface.secondaryButtonSm} inline-flex items-center gap-1`}
            >
              Ver execução
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href={monitoramentoHref}
              className={`${formSurface.primaryButtonSm} inline-flex items-center gap-1`}
            >
              Ir para monitoramento
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </PanelSection>

      <PanelSection
        title="Relação com o próximo diagnóstico"
        description="As ações podem contribuir para avaliações futuras, sem alterar o resultado FAMI já concluído."
        variant="plain"
      >
        <div className={PANEL}>
          <p className="text-sm leading-relaxed text-slate-700">
            {recommendationTypeLabel(row.recommendationType)}. Efeito esperado: potencial de
            melhoria a ser verificado em um próximo diagnóstico.
          </p>
        </div>
      </PanelSection>
    </div>
  );
}
