import type { Dispatch, SetStateAction } from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import { resolveEvidenceDraft } from "@/features/workbench/section-progress";
import { validateYesEvidenceDraftForRow } from "@/features/workbench/validate-evidence-draft";
import type { YesEvidenceFieldErrors } from "@/features/workbench/validate-yes-evidence";
import { validateNaJustification } from "@/shared/domain/not-applicable";
import {
  submitWorkbenchResponses,
  type WorkbenchResponsePayload,
} from "@/infrastructure/client/workbench-api";
import { describeError } from "@/infrastructure/notifications/notify";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { workbenchBatchResponseSchema } from "@/features/workbench/http-contracts";
import {
  buildWorkbenchEvidencePayload,
  buildWorkbenchEvidencePayloads,
} from "./workbench-response-payload";
import type { Row } from "./workbench-helpers";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";

export type WorkbenchBatchSubmissionResult = {
  didPersist: boolean;
  missingAnswer: string[];
  missingEvidence: string[];
  nextFieldErrors: Record<string, YesEvidenceFieldErrors>;
  pendingEvidenceIds: Set<string>;
  firstPendingQuestionId: string | null;
};

type Params = {
  rows: Row[];
  ids: WorkbenchIds;
  evidenceDrafts: Record<string, EvidenceDraft>;
  pendingYesQuestionIds: Set<string>;
  pendingNaQuestionIds: Set<string>;
  naJustificationDrafts: Record<string, string>;
  discardPendingUpload: (row: Row) => Promise<boolean>;
  clearQuestionValidation: (questionId: string) => void;
  clearEvidenceDraft: (questionId: string) => void;
  setNaFieldErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
  setSavingQuestionId: Dispatch<SetStateAction<string | null>>;
};

type SubmissionAccumulator = Omit<
  WorkbenchBatchSubmissionResult,
  "didPersist"
> & {
  payloads: WorkbenchResponsePayload[];
};

function createAccumulator(): SubmissionAccumulator {
  return {
    missingAnswer: [],
    missingEvidence: [],
    nextFieldErrors: {},
    pendingEvidenceIds: new Set(),
    firstPendingQuestionId: null,
    payloads: [],
  };
}

function registerMissingAnswer(accumulator: SubmissionAccumulator, row: Row) {
  if (!accumulator.missingAnswer.includes(row.prompt)) {
    accumulator.missingAnswer.push(row.prompt);
  }
  accumulator.firstPendingQuestionId ??= row.questionId;
}

function registerMissingEvidence(
  accumulator: SubmissionAccumulator,
  row: Row,
  errors?: YesEvidenceFieldErrors,
) {
  if (!accumulator.missingEvidence.includes(row.prompt)) {
    accumulator.missingEvidence.push(row.prompt);
  }
  accumulator.pendingEvidenceIds.add(row.questionId);
  if (errors) accumulator.nextFieldErrors[row.questionId] = errors;
  accumulator.firstPendingQuestionId ??= row.questionId;
}

function evidenceDraftNeedsPersist(
  row: Row,
  evidenceDrafts: Record<string, EvidenceDraft>,
): boolean {
  if (evidenceDrafts[row.questionId]) return true;
  const draft = resolveEvidenceDraft(row, evidenceDrafts);
  return (
    buildWorkbenchEvidencePayload(
      { ...row, answer: "yes" },
      draft,
      { hasLocalChanges: false },
    ) !== undefined
  );
}

async function appendRowPayload(
  row: Row,
  params: Params,
  accumulator: SubmissionAccumulator,
) {
  const draft = resolveEvidenceDraft(row, params.evidenceDrafts);
  const pendingYes = params.pendingYesQuestionIds.has(row.questionId);
  const pendingNa = params.pendingNaQuestionIds.has(row.questionId);

  if (pendingNa || (row.answer === "not_applicable" && !row.naJustification)) {
    const notes =
      params.naJustificationDrafts[row.questionId] ??
      row.naJustification ??
      row.notes ??
      "";
    const checked = validateNaJustification(notes);
    if (!checked.ok) {
      params.setNaFieldErrors((current) => ({
        ...current,
        [row.questionId]: checked.message,
      }));
      registerMissingAnswer(accumulator, row);
      return;
    }
    if (!(await params.discardPendingUpload(row))) {
      registerMissingAnswer(accumulator, row);
      return;
    }
    accumulator.payloads.push({
      questionId: row.questionId,
      expectedRevision: row.responseRevision,
      answer: "not_applicable",
      notes: checked.justification,
    });
    return;
  }

  if (!row.answer) {
    registerMissingAnswer(accumulator, row);
    return;
  }

  if (!pendingYes && !(row.answer === "yes" && row.requiresEvidence)) return;

  const errors = row.requiresEvidence
    ? validateYesEvidenceDraftForRow(row, draft)
    : {};
  if (Object.keys(errors).length > 0) {
    registerMissingEvidence(accumulator, row, errors);
    return;
  }
  if (
    !pendingYes &&
    !evidenceDraftNeedsPersist(row, params.evidenceDrafts)
  ) {
    return;
  }

  const evidences = buildWorkbenchEvidencePayloads(
    { ...row, answer: "yes" },
    draft,
    { hasLocalChanges: Boolean(params.evidenceDrafts[row.questionId]) },
  );
  if (evidences === null) {
    registerMissingEvidence(
      accumulator,
      row,
      validateYesEvidenceDraftForRow(row, draft),
    );
    return;
  }
  accumulator.payloads.push({
    questionId: row.questionId,
    expectedRevision: row.responseRevision,
    answer: "yes",
    notes: row.notes ?? "",
    ...(evidences?.length === 1
      ? { evidence: evidences[0] }
      : evidences?.length
        ? { evidences }
        : {}),
  });
}

export async function flushWorkbenchPendingRows(
  params: Params,
): Promise<WorkbenchBatchSubmissionResult> {
  const accumulator = createAccumulator();
  const rowByQuestionId = new Map(
    params.rows.map((row) => [row.questionId, row]),
  );

  for (const row of params.rows) {
    await appendRowPayload(row, params, accumulator);
  }

  let didPersist = false;
  if (accumulator.payloads.length > 0) {
    params.setSavingQuestionId("batch");
    params.setFeedback(null);
    try {
      const response = await submitWorkbenchResponses(
        params.ids,
        accumulator.payloads,
      );
      const body = await parseJson(response, workbenchBatchResponseSchema);
      if (!response.ok || !body.results) {
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Falha ao sincronizar as respostas.",
        );
      }

      for (const result of body.results) {
        const row = rowByQuestionId.get(result.questionId);
        if (!row) continue;
        if (result.status === "succeeded") {
          didPersist = true;
          params.clearQuestionValidation(row.questionId);
          params.clearEvidenceDraft(row.questionId);
          continue;
        }
        if (
          row.answer === "not_applicable" ||
          params.pendingNaQuestionIds.has(row.questionId)
        ) {
          registerMissingAnswer(accumulator, row);
        } else {
          registerMissingEvidence(accumulator, row, result.fields);
        }
      }
    } catch (error) {
      for (const payload of accumulator.payloads) {
        const row = rowByQuestionId.get(payload.questionId);
        if (!row) continue;
        if (payload.answer === "not_applicable") {
          registerMissingAnswer(accumulator, row);
        } else {
          registerMissingEvidence(accumulator, row);
        }
      }
      params.setFeedback({
        tone: "error",
        title: "Não foi possível sincronizar as respostas",
        description: describeError(error, "Tente novamente."),
      });
    } finally {
      params.setSavingQuestionId(null);
    }
  }

  const { payloads: _payloads, ...result } = accumulator;
  return { didPersist, ...result };
}
