"use client";

import { typography } from "@/shared/layout/design-system";

import { Fragment } from "react";
import { Ban, CalendarClock, Eye, FileText, Pencil, Trash2, TrendingUp, X } from "lucide-react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { UpdateActionProgressForm } from "@/features/improvement-management/action-plans/components/execution/update-action-progress-form";
import { EditActionDetailsForm } from "@/features/improvement-management/action-plans/components/execution/edit-action-details-form";
import { RequestDeadlineChangeForm } from "@/features/improvement-management/action-plans/components/execution/request-deadline-change-form";
import { ViewActionDetailsPanel } from "@/features/improvement-management/action-plans/components/execution/view-action-details-panel";
import { ActionPlanEvidenceManager } from "@/features/improvement-management/recommendations/components/hub/action-plan-evidence-manager";
import {
  ActionPlanRowOptionsMenu,
  type ActionPlanRowMenuItem,
} from "@/features/improvement-management/action-plans/components/execution/action-plan-row-options-menu";
import type { ActionPlanResponsibleMember } from "@/features/improvement-management/action-plans/client";
import { formSurface } from "@/shared/layout/form-surface";
import { formatLocalDate } from "@/shared/datetime/business-date";
import {
  OverviewSoftPanel,
  overviewActionsTable,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";

export type ActionPanelMode =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "view"; planId: string }
  | { kind: "progress"; planId: string }
  | { kind: "edit"; planId: string }
  | { kind: "deadline"; planId: string }
  | { kind: "evidence"; planId: string };

function isRowPanelOpen(panel: ActionPanelMode, planId: string): boolean {
  return (
    (panel.kind === "view" ||
      panel.kind === "progress" ||
      panel.kind === "edit" ||
      panel.kind === "deadline" ||
      panel.kind === "evidence") &&
    panel.planId === planId
  );
}

type Props = {
  plans: ActionPlanAction[];
  recommendationId: string;
  role: "respondent" | "admin";
  panel: ActionPanelMode;
  deletingId: string | null;
  responsibleMembers: ActionPlanResponsibleMember[];
  responsibleMembersLoading: boolean;
  responsibleMembersError: string | null;
  onPanelChange: (panel: ActionPanelMode) => void;
  onCancelAction?: (planId: string) => void;
  onDelete?: (plan: ActionPlanAction) => void;
  onRetryResponsibleMembers: () => void;
  onSaved: () => Promise<void>;
  onEvidenceChanged: () => Promise<void>;
};

function togglePanel(
  panel: ActionPanelMode,
  next: Exclude<ActionPanelMode, { kind: "none" } | { kind: "create" }>,
): ActionPanelMode {
  if (panel.kind === next.kind && "planId" in panel && panel.planId === next.planId) {
    return { kind: "none" };
  }
  return next;
}

function rowMenuItems(args: {
  plan: ActionPlanAction;
  role: "respondent" | "admin";
  panel: ActionPanelMode;
  isDeleting: boolean;
  onPanelChange: (panel: ActionPanelMode) => void;
  onCancelAction?: (planId: string) => void;
  onDelete?: (plan: ActionPlanAction) => void;
}): ActionPlanRowMenuItem[] {
  const { plan, role, panel, isDeleting, onPanelChange, onCancelAction, onDelete } = args;
  const viewOpen = panel.kind === "view" && panel.planId === plan.id;
  const evidenceOpen = panel.kind === "evidence" && panel.planId === plan.id;

  const viewItem: ActionPlanRowMenuItem = {
    key: "view",
    label: viewOpen ? "Fechar visualização" : "Visualizar",
    icon: viewOpen ? X : Eye,
    onSelect: () =>
      onPanelChange(togglePanel(panel, { kind: "view", planId: plan.id })),
  };

  const evidenceItem: ActionPlanRowMenuItem = {
    key: "evidence",
    label: evidenceOpen ? "Fechar comprovantes" : role === "admin" ? "Ver comprovantes" : "Comprovantes",
    icon: evidenceOpen ? X : FileText,
    onSelect: () =>
      onPanelChange(togglePanel(panel, { kind: "evidence", planId: plan.id })),
  };

  if (role !== "respondent" || plan.status === "cancelled") {
    return [viewItem, evidenceItem];
  }

  const items: ActionPlanRowMenuItem[] = [
    viewItem,
    {
      key: "progress",
      label: "Andamento",
      icon: TrendingUp,
      onSelect: () =>
        onPanelChange(togglePanel(panel, { kind: "progress", planId: plan.id })),
    },
    {
      key: "edit",
      label: "Dados",
      icon: Pencil,
      onSelect: () =>
        onPanelChange(togglePanel(panel, { kind: "edit", planId: plan.id })),
    },
    {
      key: "deadline",
      label: "Solicitar final",
      icon: CalendarClock,
      onSelect: () =>
        onPanelChange(togglePanel(panel, { kind: "deadline", planId: plan.id })),
    },
    evidenceItem,
  ];

  if (onCancelAction) {
    items.push({
      key: "cancel",
      label: "Cancelar",
      icon: Ban,
      onSelect: () => onCancelAction(plan.id),
    });
  }

  if (onDelete) {
    items.push({
      key: "delete",
      label: "Remover",
      icon: Trash2,
      tone: "danger",
      disabled: isDeleting,
      onSelect: () => onDelete(plan),
    });
  }

  return items;
}

export function ActionPlanActionList({
  plans,
  recommendationId,
  role,
  panel,
  deletingId,
  responsibleMembers,
  responsibleMembersLoading,
  responsibleMembersError,
  onPanelChange,
  onCancelAction,
  onDelete,
  onRetryResponsibleMembers,
  onSaved,
  onEvidenceChanged,
}: Props) {
  return (
    <OverviewSoftPanel padded={false} className="overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className={overviewActionsTable.table}>
          <thead>
            <tr className={overviewActionsTable.headRow}>
              <th scope="col" className={overviewActionsTable.headCell}>
                Ação
              </th>
              <th scope="col" className={overviewActionsTable.headCell}>
                Situação
              </th>
              <th scope="col" className={overviewActionsTable.headCell}>
                Início
              </th>
              <th scope="col" className={overviewActionsTable.headCell}>
                Final
              </th>
              <th scope="col" className={overviewActionsTable.headCell}>
                Opções
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const sla = computeActionSla({ dueDate: plan.dueDate, status: plan.status });
              const isOpen = isRowPanelOpen(panel, plan.id);
              const isDeleting = deletingId === plan.id;
              const isCancelled = plan.status === "cancelled";
              const isOverdue = sla === "overdue" && !isCancelled;

              return (
                <Fragment key={plan.id}>
                  <tr className={overviewActionsTable.bodyRow}>
                    <td className={overviewActionsTable.bodyCell}>
                      <p className="line-clamp-3 break-words font-medium text-slate-900">
                        {plan.actionText}
                      </p>
                    </td>
                    <td className={overviewActionsTable.bodyCell}>
                      {PLAN_STATUS_LABELS[plan.status]}
                    </td>
                    <td className={overviewActionsTable.bodyCell}>
                      <p className="text-slate-800">{formatLocalDate(plan.startDate)}</p>
                    </td>
                    <td className={overviewActionsTable.bodyCell}>
                      <p
                        className={
                          isOverdue ? "font-medium text-rose-700" : "text-slate-800"
                        }
                      >
                        {formatLocalDate(plan.dueDate)}
                      </p>
                      {isOverdue ? (
                        <p className="mt-0.5 text-xs font-medium text-rose-700">Atrasada</p>
                      ) : null}
                    </td>
                    <td className={overviewActionsTable.bodyCell}>
                      <ActionPlanRowOptionsMenu
                        actionLabel={plan.actionText}
                        disabled={isDeleting}
                        items={rowMenuItems({
                          plan,
                          role,
                          panel,
                          isDeleting,
                          onPanelChange,
                          onCancelAction,
                          onDelete,
                        })}
                      />
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className={overviewActionsTable.openRow}>
                      <td colSpan={5} className="px-4 py-4 sm:px-5">
                        {panel.kind === "view" ? (
                          <ViewActionDetailsPanel
                            plan={plan}
                            role={role}
                            onClose={() => onPanelChange({ kind: "none" })}
                          />
                        ) : null}
                        {panel.kind === "progress" ? (
                          <UpdateActionProgressForm
                            plan={plan}
                            recommendationId={recommendationId}
                            onCancel={() => onPanelChange({ kind: "none" })}
                            onSaved={onSaved}
                          />
                        ) : null}
                        {panel.kind === "edit" ? (
                          <EditActionDetailsForm
                            plan={plan}
                            recommendationId={recommendationId}
                            responsibleMembers={responsibleMembers}
                            responsibleMembersLoading={responsibleMembersLoading}
                            responsibleMembersError={responsibleMembersError}
                            onRetryResponsibleMembers={onRetryResponsibleMembers}
                            onCancel={() => onPanelChange({ kind: "none" })}
                            onSaved={onSaved}
                          />
                        ) : null}
                        {panel.kind === "deadline" ? (
                          <RequestDeadlineChangeForm
                            plan={plan}
                            recommendationId={recommendationId}
                            onCancel={() => onPanelChange({ kind: "none" })}
                            onSaved={onSaved}
                          />
                        ) : null}
                        {panel.kind === "evidence" ? (
                          <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className={typography.subsectionTitle}>Comprovantes</h3>
                              <button
                                type="button"
                                className={formSurface.ghostButton}
                                onClick={() => onPanelChange({ kind: "none" })}
                              >
                                fechar
                              </button>
                            </div>
                            <ActionPlanEvidenceManager
                              embedded
                              plan={plan}
                              onChanged={onEvidenceChanged}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </OverviewSoftPanel>
  );
}
