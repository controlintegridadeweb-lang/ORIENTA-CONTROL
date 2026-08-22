import type { PlanStatus } from "./schemas";
import type { ActionPlanProgressUpdate } from "./types";
import { ACTION_PLAN_REGISTRY } from "@/shared/ui/status-registry";

export function formatProgressTransition(previous: number, next: number): string {
  return `${previous}% → ${next}%`;
}

export function progressUpdateBody(
  update: Pick<
    ActionPlanProgressUpdate,
    "description" | "previousPercentage" | "newPercentage" | "previousStatus"
  >,
): string {
  const text = update.description?.trim();
  if (text) return text;
  if (
    update.previousPercentage === 0 &&
    update.newPercentage === 0 &&
    update.previousStatus === "not_started"
  ) {
    return "Ação cadastrada.";
  }
  return "Atualização de progresso registrada.";
}

export function progressUpdateHistoryText(
  update: Pick<
    ActionPlanProgressUpdate,
    "description" | "previousPercentage" | "newPercentage" | "previousStatus"
  >,
): string {
  const text = update.description?.trim();
  if (text) return text;
  if (update.previousPercentage !== update.newPercentage) {
    return `Progresso atualizado para ${update.newPercentage}%`;
  }
  return progressUpdateBody(update);
}

export function progressUpdateHeadline(
  update: Pick<
    ActionPlanProgressUpdate,
    "previousPercentage" | "newPercentage" | "previousStatus" | "newStatus"
  >,
): string {
  const progressChanged = update.previousPercentage !== update.newPercentage;
  const statusChanged = update.previousStatus !== update.newStatus;
  const progressLabel = formatProgressTransition(
    update.previousPercentage,
    update.newPercentage,
  );
  const statusLabel = `${statusName(update.previousStatus)} → ${statusName(update.newStatus)}`;

  if (progressChanged && statusChanged) return `${progressLabel} · ${statusLabel}`;
  if (progressChanged) return progressLabel;
  if (statusChanged) return statusLabel;
  return "Atualização registrada";
}

function statusName(status: PlanStatus): string {
  return ACTION_PLAN_REGISTRY[status].label;
}
