import type { ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";
import { countLabel } from "@/shared/format/count-label";

export const ACTION_DOCUMENT_STATUS_LABEL: Record<
  ActionPlanDocument["fileValidationStatus"],
  string
> = {
  not_applicable: "Link disponível",
  valid: "Formato validado",
  rejected: "Formato rejeitado",
  removed: "Removido",
};

export const RECENT_DOCUMENT_LIMIT = 3;

export function currentActionDocuments(
  documents: ActionPlanDocument[],
): ActionPlanDocument[] {
  return documents
    .filter((document) => document.isCurrentRevision)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function summarizeActionDocuments(documents: ActionPlanDocument[]): {
  current: ActionPlanDocument[];
  recent: ActionPlanDocument[];
  line: string | null;
} {
  const current = currentActionDocuments(documents);
  if (current.length === 0) {
    return { current, recent: [], line: null };
  }

  const rejected = current.filter((document) => document.fileValidationStatus === "rejected").length;
  const parts = [countLabel(current.length, "comprovação", "comprovações")];
  if (rejected > 0) {
    parts.push(countLabel(rejected, "formato rejeitado", "formatos rejeitados"));
  }

  return {
    current,
    recent: current.slice(0, RECENT_DOCUMENT_LIMIT),
    line: parts.join(" · "),
  };
}
