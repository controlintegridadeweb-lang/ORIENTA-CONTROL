import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { validateNaJustification } from "@/shared/domain/not-applicable";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import { resolveEvidenceDraft } from "@/features/workbench/section-progress";
import { canSaveYesEvidenceDraft } from "@/features/workbench/validate-evidence-draft";

export type SectionCompletion = {
  completed: number;
  total: number;
};

type CompletionContext = {
  evidenceDrafts: Record<string, EvidenceDraft>;
  pendingYesQuestionIds?: ReadonlySet<string>;
  pendingNaQuestionIds?: ReadonlySet<string>;
  naJustificationDrafts?: Record<string, string>;
};

function effectiveAnswer(
  row: WorkbenchRow,
  context: CompletionContext,
): "yes" | "no" | "not_applicable" | null {
  if (context.pendingYesQuestionIds?.has(row.questionId)) return "yes";
  if (context.pendingNaQuestionIds?.has(row.questionId)) return "not_applicable";
  return row.answer;
}

function isQuestionComplete(
  row: WorkbenchRow,
  context: CompletionContext,
): boolean {
  const answer = effectiveAnswer(row, context);
  if (!answer) return false;

  if (answer === "not_applicable") {
    const justification =
      context.naJustificationDrafts?.[row.questionId] ??
      row.naJustification ??
      row.notes ??
      "";
    return validateNaJustification(justification).ok;
  }

  if (answer !== "yes" || !row.requiresEvidence) return true;

  const draft = resolveEvidenceDraft(row, context.evidenceDrafts);
  return canSaveYesEvidenceDraft(row, draft);
}

export function sectionCompletion(
  rows: WorkbenchRow[],
  context: CompletionContext,
): SectionCompletion {
  return {
    completed: rows.filter((row) => isQuestionComplete(row, context)).length,
    total: rows.length,
  };
}
