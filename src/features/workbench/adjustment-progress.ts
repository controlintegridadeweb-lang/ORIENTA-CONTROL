import type { WorkbenchRow } from "./load-workbench-payload";

function unresolvedCountForRow(row: WorkbenchRow): number {
  if (typeof row.unresolvedAdjustmentRequestCount === "number") {
    return Math.max(0, row.unresolvedAdjustmentRequestCount);
  }
  const hasUnresolvedAdjustment =
    row.hasAdjustmentRequest === true &&
    row.hasResolvedAllAdjustments !== true;
  return hasUnresolvedAdjustment ? 1 : 0;
}

/** Retorna somente perguntas que ainda possuem ao menos uma correção pendente. */
export function unresolvedAdjustmentRows(
  rows: readonly WorkbenchRow[],
  excludedQuestionId?: string,
): WorkbenchRow[] {
  return rows.filter(
    (row) =>
      row.questionId !== excludedQuestionId &&
      unresolvedCountForRow(row) > 0,
  );
}

/** Conta evidências devolvidas ainda sem uma substituição própria. */
export function countUnresolvedAdjustments(
  rows: readonly WorkbenchRow[],
  excludedQuestionId?: string,
): number {
  return rows.reduce((total, row) => {
    if (row.questionId === excludedQuestionId) return total;
    return total + unresolvedCountForRow(row);
  }, 0);
}
