"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { CreateActionForm } from "@/features/improvement-management/action-plans/components/execution/create-action-form";
import { CancelActionDialog } from "@/features/improvement-management/action-plans/components/execution/cancel-action-dialog";
import {
  ActionPlanActionList,
  type ActionPanelMode,
} from "@/features/improvement-management/action-plans/components/execution/action-plan-action-list";
import { useActionWorkspacePanel } from "@/features/improvement-management/action-plans/components/execution/use-action-workspace-panel";
import { useActionPlanResponsibleMembers } from "@/features/improvement-management/action-plans/components/execution/use-action-plan-responsible-members";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import { deleteRespondentActionPlan } from "@/features/improvement-management/action-plans/client";
import { ActionPlanEmptyState } from "./action-plan-empty-state";
import { useRecommendationDetailContext } from "./recommendation-detail-context";
import { isActionPlanEligible } from "@/shared/domain/workflow";
import { actionPlanAvailabilityForCycleState } from "@/features/improvement-management/action-plans/availability";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { useTableSync } from "@/infrastructure/supabase/use-table-sync";
import {
  OverviewBlockTitle,
  OverviewSoftPanel,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";

function isSameActionPanel(left: ActionPanelMode, right: ActionPanelMode): boolean {
  if (left.kind !== right.kind) return false;
  if (!("planId" in left) || !("planId" in right)) return true;
  return left.planId === right.planId;
}

function sortPlans(plans: ActionPlanAction[]): ActionPlanAction[] {
  return [...plans].sort((a, b) => {
    const sa = computeActionSla({ dueDate: a.dueDate, status: a.status });
    const sb = computeActionSla({ dueDate: b.dueDate, status: b.status });
    const aOver = sa === "overdue";
    const bOver = sb === "overdue";
    if (aOver !== bOver) return aOver ? -1 : 1;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  });
}

/** Workspace de execução — aba Plano de ação (sem indicadores de monitoramento). */
export function RecommendationActionsWorkspace() {
  const ctx = useRecommendationDetailContext();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const row = ctx.row;
  const [cancelPlanId, setCancelPlanId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const localMutationRef = useRef(false);
  const responsible = useActionPlanResponsibleMembers(ctx.role === "respondent");

  const ordered = useMemo(() => (row ? sortPlans(row.plans) : []), [row]);
  const planIds = useMemo(() => new Set(ordered.map((plan) => plan.id)), [ordered]);
  const { panel, setPanel, hasOverride } = useActionWorkspacePanel(planIds);
  const actionCount = ordered.length;
  const openCreateFromQuery = searchParams.get("new") === "1" && actionCount === 0;
  const activePanel = hasOverride
    ? panel
    : openCreateFromQuery
      ? { kind: "create" as const }
      : panel;
  const panelRef = useRef(activePanel);
  panelRef.current = activePanel;

  async function handleRemotePlanChange() {
    if (localMutationRef.current) return;
    if (activePanel.kind !== "none") {
      notify.warning("O plano foi alterado em outra aba. Recarregue os dados antes de salvar sua edição.", {
        id: "action-plan-remote-change",
      });
      return;
    }
    await ctx.refetch();
  }

  useTableSync({
    table: "action_plans",
    filter: row ? `recommendation_id=eq.${row.recommendationId}` : "",
    enabled: Boolean(row),
    onChange: handleRemotePlanChange,
  });

  useTableSync({
    table: "action_plan_documents",
    filter: row ? `organization_id=eq.${row.organizationId}` : "",
    enabled: Boolean(row),
    onChange: handleRemotePlanChange,
  });

  if (!row) return null;

  const recommendationId = row.recommendationId;
  const canManageActions = isActionPlanEligible(row.cycleState);
  const availability = actionPlanAvailabilityForCycleState(row.cycleState);
  if (row.recommendationStatus === "exception_requested") {
    return (
      <section
        className={`${formSurface.messageWarning} space-y-2`}
        aria-labelledby="action-plan-exception-pending-title"
      >
        <h2 id="action-plan-exception-pending-title" className={typography.cardTitle}>
          Exceção institucional em análise
        </h2>
        <p>
          O cadastro e a alteração de ações ficam bloqueados até a decisão administrativa.
          Acompanhe a solicitação na visão geral da recomendação.
        </p>
      </section>
    );
  }
  if (row.recommendationStatus === "dismissed") {
    return (
      <section
        className={`${formSurface.messageNeutral} space-y-2`}
        aria-labelledby="action-plan-dismissed-title"
      >
        <h2 id="action-plan-dismissed-title" className={typography.cardTitle}>
          Recomendação dispensada
        </h2>
        <p>Não é necessário cadastrar plano de ação para esta recomendação.</p>
      </section>
    );
  }
  if (!canManageActions && availability) {
    const cycleHref =
      ctx.role === "respondent"
        ? `/respondente/ciclos/${encodeURIComponent(row.cycleId ?? "")}?returnTo=${encodeURIComponent(searchParams.get("returnTo") ?? ctx.listPath)}`
        : `/admin/ciclos/${encodeURIComponent(row.cycleId ?? "")}`;
    return (
      <section
        className={`${formSurface.messageNeutral} space-y-3`}
        aria-labelledby="action-plan-availability-title"
      >
        <div>
          <h2 id="action-plan-availability-title" className={typography.cardTitle}>
            {availability.title}
          </h2>
          <p className="mt-1">{availability.description}</p>
        </div>
        <Link
          href={cycleHref}
          className={`${formSurface.secondaryButtonSm} inline-flex w-fit items-center gap-2`}
        >
          Acompanhar diagnóstico
        </Link>
      </section>
    );
  }

  async function withLocalMutation(run: () => Promise<void>) {
    localMutationRef.current = true;
    try {
      await run();
    } finally {
      window.setTimeout(() => {
        localMutationRef.current = false;
      }, 2_000);
    }
  }

  function closeCreatePanel() {
    setPanel({ kind: "none" });
  }

  async function handleDelete(plan: ActionPlanAction) {
    const confirmed = await confirm({
      title: "Remover esta ação?",
      description: "A ação será excluída do plano. Essa operação não pode ser desfeita.",
      confirmLabel: "Remover",
      cancelLabel: "Manter",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingId(plan.id);
    await withLocalMutation(async () => {
      try {
        await deleteRespondentActionPlan({
          planId: plan.id,
          recommendationId,
          expectedRevision: plan.revision,
        });
        setPanel({ kind: "none" });
        notify.success("Ação removida.");
        await ctx.refetch();
      } catch (e) {
        notify.error(describeError(e, "Falha ao remover a ação."));
      } finally {
        setDeletingId(null);
      }
    });
  }

  async function handleSaved() {
    const panelBeingSaved = panelRef.current;
    await withLocalMutation(async () => {
      await ctx.refetch();
      // O selo “Concluída” do slider aparece antes do refetch. Se o
      // respondente já abriu comprovantes, fechar o painel antigo apaga o
      // compositor e o botão some no meio do clique.
      if (isSameActionPanel(panelRef.current, panelBeingSaved)) {
        setPanel({ kind: "none" });
      }
    });
  }

  const cancelPlan = cancelPlanId
    ? ordered.find((plan) => plan.id === cancelPlanId) ?? null
    : null;

  return (
    <div className={layout.panelStack}>
      <section aria-labelledby="rec-actions-heading" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <OverviewBlockTitle
            id="rec-actions-heading"
            title="Ações do plano"
            description={
              actionCount > 0
                ? "Execute e atualize as ações desta recomendação."
                : "Cadastre a primeira ação para iniciar a execução."
            }
          />
          {actionCount > 0 && ctx.role === "respondent" ? (
            <button
              type="button"
              className={`${formSurface.primaryButtonSm} inline-flex items-center gap-2`}
              onClick={() =>
                setPanel(activePanel.kind === "create" ? { kind: "none" } : { kind: "create" })
              }
              aria-expanded={activePanel.kind === "create"}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nova ação
            </button>
          ) : null}
        </div>

        {activePanel.kind === "create" && ctx.role === "respondent" ? (
          <OverviewSoftPanel className="mb-4">
            <CreateActionForm
              recommendationId={row.recommendationId}
              recommendationText={row.recommendationText}
              axisName={row.axisName}
              responsibleMembers={responsible.members}
              responsibleMembersLoading={responsible.loading}
              responsibleMembersError={responsible.error}
              onRetryResponsibleMembers={() => void responsible.reload()}
              onCancel={closeCreatePanel}
              onCreated={async () => {
                await withLocalMutation(async () => {
                  await ctx.refetch();
                  closeCreatePanel();
                });
              }}
            />
          </OverviewSoftPanel>
        ) : null}

        {actionCount === 0 && activePanel.kind !== "create" ? (
          ctx.role === "respondent" ? (
            <ActionPlanEmptyState onCreate={() => setPanel({ kind: "create" })} />
          ) : (
            <OverviewSoftPanel>
              <p className={formSurface.empty.title}>Nenhuma ação cadastrada.</p>
              <p className="mt-1 text-sm text-slate-600">
                A organização ainda não vinculou ações a esta recomendação.
              </p>
            </OverviewSoftPanel>
          )
        ) : actionCount > 0 ? (
          <ActionPlanActionList
            plans={ordered}
            recommendationId={row.recommendationId}
            role={ctx.role}
            panel={activePanel}
            deletingId={deletingId}
            responsibleMembers={responsible.members}
            responsibleMembersLoading={responsible.loading}
            responsibleMembersError={responsible.error}
            onPanelChange={setPanel}
            onCancelAction={setCancelPlanId}
            onDelete={(plan) => void handleDelete(plan)}
            onRetryResponsibleMembers={() => void responsible.reload()}
            onSaved={handleSaved}
            onEvidenceChanged={ctx.refetch}
          />
        ) : null}
      </section>

      {cancelPlan ? (
        <CancelActionDialog
          open
          plan={cancelPlan}
          recommendationId={row.recommendationId}
          onClose={() => setCancelPlanId(null)}
          onCancelled={async () => {
            await withLocalMutation(async () => {
              await ctx.refetch();
              setPanel({ kind: "none" });
            });
          }}
        />
      ) : null}
    </div>
  );
}
