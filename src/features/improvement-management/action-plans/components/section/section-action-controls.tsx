"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, CalendarClock, CalendarPlus, Eye, FileText, Pencil, Trash2 } from "lucide-react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import type { ActionPanelMode } from "@/features/improvement-management/action-plans/components/execution/action-plan-action-list";
import { UpdateActionProgressForm } from "@/features/improvement-management/action-plans/components/execution/update-action-progress-form";
import { EditActionDetailsForm } from "@/features/improvement-management/action-plans/components/execution/edit-action-details-form";
import { RequestDeadlineChangeForm } from "@/features/improvement-management/action-plans/components/execution/request-deadline-change-form";
import { ViewActionDetailsPanel } from "@/features/improvement-management/action-plans/components/execution/view-action-details-panel";
import { CancelActionDialog } from "@/features/improvement-management/action-plans/components/execution/cancel-action-dialog";
import { useActionPlanResponsibleMembers } from "@/features/improvement-management/action-plans/components/execution/use-action-plan-responsible-members";
import {
  ActionPlanRowOptionsMenu,
  type ActionPlanRowMenuItem,
} from "@/features/improvement-management/action-plans/components/execution/action-plan-row-options-menu";
import { ActionPlanEvidenceManager } from "@/features/improvement-management/recommendations/components/hub/action-plan-evidence-manager";
import type { SectionActionPlanWorkspaceRole } from "@/features/improvement-management/action-plans/components/section/section-workspace-navigation";
import { deleteRespondentActionPlan } from "@/features/improvement-management/action-plans/client";
import { invalidateRespondentOverviewCache } from "@/features/improvement-management/action-plans/respondent-overview/cache";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { describeError, notify } from "@/infrastructure/notifications/notify";

type Tool = Exclude<ActionPanelMode, { kind: "none" } | { kind: "create" }>["kind"];

type Props = {
  role: SectionActionPlanWorkspaceRole;
  action: ActionPlanAction;
  recommendationId: string;
};

function initialTool(actionId: string, searchParams: { get: (key: string) => string | null }): Tool | null {
  if (searchParams.get("action") !== actionId) return null;
  return searchParams.get("panel") === "progress" ? "progress" : null;
}

export function SectionActionControls({ role, action, recommendationId }: Props) {
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const [tool, setTool] = useState<Tool | null>(() => initialTool(action.id, searchParams));
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const needsMembers = role === "respondent" && tool === "edit";
  const responsible = useActionPlanResponsibleMembers(needsMembers);
  const cancelled = action.status === "cancelled";

  function toggle(next: Tool) {
    setTool((current) => (current === next ? null : next));
  }

  async function refresh() {
    invalidateRespondentOverviewCache();
  }

  async function removeAction() {
    const accepted = await confirm({
      title: "Remover esta ação?",
      description: "A ação será excluída do plano. Essa operação não pode ser desfeita.",
      confirmLabel: "Remover",
      cancelLabel: "Manter",
      tone: "danger",
    });
    if (!accepted) return;
    setDeleting(true);
    try {
      await deleteRespondentActionPlan({
        planId: action.id,
        recommendationId,
        expectedRevision: action.revision,
      });
      notify.success("Ação removida.");
      setTool(null);
      await refresh();
    } catch (caught) {
      notify.error(describeError(caught, "Falha ao remover a ação."));
    } finally {
      setDeleting(false);
    }
  }

  const menuItems: ActionPlanRowMenuItem[] = [
    {
      key: "view",
      label: "Visualizar",
      icon: Eye,
      onSelect: () => toggle("view"),
    },
    ...(role === "respondent" && !cancelled
      ? [
          {
            key: "edit",
            label: "Dados",
            icon: Pencil,
            onSelect: () => toggle("edit"),
          },
          {
            key: "start",
            label: "Solicitar início",
            icon: CalendarPlus,
            onSelect: () => toggle("start"),
          },
          {
            key: "deadline",
            label: "Solicitar final",
            icon: CalendarClock,
            onSelect: () => toggle("deadline"),
          },
        ]
      : []),
    {
      key: "evidence",
      label: "Comprovantes",
      icon: FileText,
      onSelect: () => toggle("evidence"),
    },
    ...(role === "respondent" && !cancelled
      ? [
          {
            key: "cancel",
            label: "Cancelar",
            icon: Ban,
            onSelect: () => setCancelOpen(true),
          },
          {
            key: "delete",
            label: "Remover",
            icon: Trash2,
            tone: "danger" as const,
            disabled: deleting,
            onSelect: () => void removeAction(),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {role === "respondent" && !cancelled ? (
          <button
            type="button"
            className={formSurface.secondaryButtonSm}
            aria-expanded={tool === "progress"}
            onClick={() => toggle("progress")}
          >
            {tool === "progress" ? "Fechar andamento" : "Andamento"}
          </button>
        ) : null}
        <ActionPlanRowOptionsMenu
          actionLabel={action.actionText}
          triggerLabel={role === "respondent" ? "Gerenciar ação" : "Ver ação"}
          disabled={deleting}
          items={menuItems}
        />
      </div>

      {tool ? (
        <div className="col-span-full w-full min-w-0 border-t border-slate-100 pt-4">
          {tool === "progress" && role === "respondent" ? (
            <UpdateActionProgressForm
              embedded
              plan={action}
              recommendationId={recommendationId}
              onCancel={() => setTool(null)}
              onSaved={async () => {
                setTool(null);
                await refresh();
              }}
            />
          ) : null}
          {tool === "view" ? (
            <ViewActionDetailsPanel plan={action} role={role} onClose={() => setTool(null)} />
          ) : null}
          {tool === "edit" && role === "respondent" ? (
            <EditActionDetailsForm
              plan={action}
              recommendationId={recommendationId}
              responsibleMembers={responsible.members}
              responsibleMembersLoading={responsible.loading}
              responsibleMembersError={responsible.error}
              onRetryResponsibleMembers={() => void responsible.reload()}
              onCancel={() => setTool(null)}
              onSaved={async () => {
                setTool(null);
                await refresh();
              }}
            />
          ) : null}
          {tool === "start" || tool === "deadline" ? (
            <RequestDeadlineChangeForm
              plan={action}
              recommendationId={recommendationId}
              target={tool === "start" ? "start_date" : "due_date"}
              onCancel={() => setTool(null)}
              onSaved={async () => {
                setTool(null);
                await refresh();
              }}
            />
          ) : null}
          {tool === "evidence" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className={typography.subsectionTitle}>Comprovantes</h3>
                <button type="button" className={formSurface.secondaryButtonSm} onClick={() => setTool(null)}>
                  Fechar
                </button>
              </div>
              <ActionPlanEvidenceManager embedded plan={action} onChanged={refresh} />
            </div>
          ) : null}
        </div>
      ) : null}

      <CancelActionDialog
        open={cancelOpen}
        plan={action}
        recommendationId={recommendationId}
        onClose={() => setCancelOpen(false)}
        onCancelled={async () => {
          setCancelOpen(false);
          setTool(null);
          await refresh();
        }}
      />
    </>
  );
}
