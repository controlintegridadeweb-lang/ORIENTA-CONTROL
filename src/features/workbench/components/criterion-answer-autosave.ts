import type { WorkbenchPayload, Row } from "./workbench-helpers";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type CriterionAutosaveState = {
  status: AutosaveStatus;
  errorMessage?: string;
};

export type CriterionAnswerValue = "yes" | "no" | "not_applicable";

export type SaveCriterionAnswerInput = {
  applicationId: string;
  criterionId: string;
  answer: CriterionAnswerValue;
  justification?: string;
};

/** Debounce de campos textuais (justificativa N/A): 500–800 ms. */
export const AUTOSAVE_TEXT_DEBOUNCE_MS = 600;

/** Tempo em que o indicador “Salvo” permanece visível após confirmação. */
export const AUTOSAVE_SAVED_VISIBLE_MS = 2500;

export const AUTOSAVE_ERROR_MESSAGE = "Não foi possível salvar";

export function emptyAutosaveState(): CriterionAutosaveState {
  return { status: "idle" };
}

/** Compara a intenção atual com o que já está confirmado no servidor. */
export function isPersistedAnswerUnchanged(
  row: Pick<Row, "answer" | "notes" | "naJustification">,
  answer: CriterionAnswerValue,
  notes: string,
): boolean {
  if (row.answer !== answer) return false;
  if (answer === "not_applicable") {
    const persisted = (row.naJustification ?? row.notes ?? "").trim();
    return persisted === notes.trim();
  }
  return true;
}

/**
 * Atualiza apenas o critério persistido no snapshot local.
 * Evita recarregar o formulário inteiro após um save granular de resposta.
 */
export function patchWorkbenchRowAfterAnswerSave(
  payload: WorkbenchPayload,
  questionId: string,
  response: {
    id: string;
    answer: CriterionAnswerValue;
    notes: string | null;
    revision: number;
  },
): WorkbenchPayload {
  return {
    ...payload,
    rows: payload.rows.map((row) => {
      if (row.questionId !== questionId) return row;

      const nextAnswer = response.answer;
      const leftYesWithEvidence =
        row.answer === "yes" &&
        nextAnswer !== "yes" &&
        Boolean(row.evidenceId || (row.evidences?.length ?? 0) > 0);

      if (leftYesWithEvidence) {
        return {
          ...row,
          responseId: response.id,
          responseRevision: response.revision,
          answer: nextAnswer,
          notes: response.notes,
          isNotApplicable: nextAnswer === "not_applicable",
          naJustification:
            nextAnswer === "not_applicable" ? response.notes : null,
          naValidationStatus:
            nextAnswer === "not_applicable"
              ? (row.naValidationStatus ?? "pending")
              : null,
          evidenceId: null,
          evidenceTitle: null,
          evidenceDescription: null,
          externalLink: null,
          storagePath: null,
          validationStatus: null,
          validationJustification: null,
          evidences: [],
          hasAdjustmentRequest: false,
          adjustmentRequestCount: 0,
          resolvedAdjustmentRequestCount: 0,
          unresolvedAdjustmentRequestCount: 0,
          hasResolvedAllAdjustments: false,
        };
      }

      return {
        ...row,
        responseId: response.id,
        responseRevision: response.revision,
        answer: nextAnswer,
        notes: response.notes,
        isNotApplicable: nextAnswer === "not_applicable",
        naJustification:
          nextAnswer === "not_applicable"
            ? response.notes
            : nextAnswer === row.answer
              ? row.naJustification
              : null,
        naValidationStatus:
          nextAnswer === "not_applicable"
            ? (row.naValidationStatus ?? "pending")
            : null,
      };
    }),
  };
}

/** Indica se a mudança de resposta exige reconciliar evidências via reload. */
export function answerChangeRequiresFullReload(
  row: Pick<Row, "answer" | "evidenceId" | "evidences">,
  nextAnswer: CriterionAnswerValue,
  hasEvidencePayload: boolean,
): boolean {
  if (hasEvidencePayload) return true;
  if (
    row.answer === "yes" &&
    nextAnswer !== "yes" &&
    Boolean(row.evidenceId || (row.evidences?.length ?? 0) > 0)
  ) {
    return true;
  }
  return false;
}
