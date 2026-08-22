"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiResponseSchema, parseJson } from "@/infrastructure/api/fetch-client";
import { submitRespondentCycle } from "@/infrastructure/client/workbench-api";
import { invalidateRespondentOverviewCache } from "@/features/improvement-management";
import { respondentSubmissionConfirmationPath } from "@/shared/navigation/respondent-portfolio-paths";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { countUnresolvedAdjustments, unresolvedAdjustmentRows } from "@/features/workbench/adjustment-progress";
import type { Mode, WorkbenchPayload } from "./workbench-helpers";
import type { YesEvidenceFieldErrors } from "@/features/workbench/validate-yes-evidence";
import type { WorkbenchBatchSubmissionResult } from "./workbench-batch-submission";
import type { WorkbenchFeedback } from "./workbench-types";

type SubmissionFlushResult = WorkbenchBatchSubmissionResult;

const submissionResponseSchema = apiResponseSchema({});

export function useWorkbenchSubmission({
  data,
  mode,
  questionFocusMode,
  submissionReturnTo,
  flushPendingRowsForSubmission,
  registerPendingEvidence,
  loadWorkbench,
  loadWorkbenchData,
  focusQuestion,
  setFeedback,
}: {
  data: WorkbenchPayload | null;
  mode: Mode;
  questionFocusMode: boolean;
  submissionReturnTo?: string;
  flushPendingRowsForSubmission: (rows: WorkbenchPayload["rows"]) => Promise<SubmissionFlushResult>;
  registerPendingEvidence: (
    fieldErrors: Record<string, YesEvidenceFieldErrors>,
    pendingEvidenceIds: Set<string>,
  ) => void;
  loadWorkbench: () => Promise<boolean>;
  loadWorkbenchData: () => Promise<WorkbenchPayload | null>;
  focusQuestion: (questionId: string | null) => void;
  setFeedback: (feedback: WorkbenchFeedback | null) => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [submittingForm, setSubmittingForm] = useState(false);

  const submitCycleForValidation = useCallback(async (
    cycleId: string,
    options: { isResubmission: boolean },
  ) => {
    setSubmittingForm(true);
    setFeedback(null);
    const loadingId = notify.loading(
      options.isResubmission
        ? "Reenviando correções para validação…"
        : "Enviando diagnóstico para validação…",
    );

    try {
      const response = await submitRespondentCycle(cycleId);
      const payload = await parseJson(response, submissionResponseSchema);
      if (!response.ok) {
        notify.dismiss(loadingId);
        setFeedback({
          tone: "error",
          title: options.isResubmission
            ? "Não foi possível reenviar as correções"
            : "Não foi possível enviar o diagnóstico",
          description:
            payload.error ??
            (options.isResubmission
              ? "Falha ao reenviar as correções. Revise sua conexão e tente novamente."
              : "Falha ao enviar o diagnóstico. Revise sua conexão e tente novamente."),
          retryAction: "submit",
        });
        return;
      }

      invalidateRespondentOverviewCache();
      notify.success(
        options.isResubmission
          ? "Correções reenviadas com sucesso."
          : "Diagnóstico enviado para validação.",
        { id: loadingId },
      );
      router.refresh();
      router.replace(
        respondentSubmissionConfirmationPath(cycleId, submissionReturnTo, {
          submissionKind: options.isResubmission ? "corrections" : "diagnostic",
        }),
      );
    } catch (error: unknown) {
      notify.dismiss(loadingId);
      setFeedback({
        tone: "error",
        title: options.isResubmission
          ? "Não foi possível reenviar as correções"
          : "Não foi possível enviar o diagnóstico",
        description: describeError(
          error,
          options.isResubmission
            ? "Falha ao reenviar as correções. Revise sua conexão e tente novamente."
            : "Falha ao enviar o diagnóstico. Revise sua conexão e tente novamente.",
        ),
        retryAction: "submit",
      });
    } finally {
      setSubmittingForm(false);
    }
  }, [router, setFeedback, submissionReturnTo]);

  const handleSubmitForm = useCallback(async () => {
    if (!data?.rows.length) return;
    const {
      didPersist,
      missingAnswer,
      missingEvidence,
      nextFieldErrors,
      pendingEvidenceIds,
      firstPendingQuestionId,
    } = await flushPendingRowsForSubmission(data.rows);

    let currentPayload = data;
    let totalPending = missingAnswer.length + missingEvidence.length;
    if (didPersist) {
      const refreshedPayload = await loadWorkbenchData();
      if (mode === "respondent") invalidateRespondentOverviewCache();
      if (!refreshedPayload) {
        setFeedback({
          tone: "error",
          title: "A tela não pôde ser atualizada",
          description:
            "As respostas válidas foram salvas. Carregue o diagnóstico novamente antes de continuar.",
          retryAction: "reload",
        });
        return;
      }
      currentPayload = refreshedPayload;
      if (
        mode === "respondent" &&
        refreshedPayload.cycle.state === "awaiting_adjustment"
      ) {
        totalPending = countUnresolvedAdjustments(refreshedPayload.rows);
      }
    }

    if (totalPending > 0 && currentPayload.cycle.state !== "awaiting_adjustment") {
      registerPendingEvidence(nextFieldErrors, pendingEvidenceIds);
      const parts: string[] = [];
      if (missingAnswer.length > 0) parts.push(`${missingAnswer.length} sem resposta`);
      if (missingEvidence.length > 0) {
        parts.push(`${missingEvidence.length} com evidência pendente`);
      }
      focusQuestion(firstPendingQuestionId);
      setFeedback({
        tone: "warning",
        title: `Faltam ${totalPending} pergunta${totalPending === 1 ? "" : "s"} para concluir`,
        description: `${parts.join(" • ")}. Você foi direcionado(a) ao primeiro item pendente.`,
      });
      return;
    }

    if (mode !== "respondent") {
      notify.success("Formulário completo: todas as respostas já estão salvas.");
      return;
    }

    const cycleId = currentPayload.cycle.id;
    if (!cycleId) {
      setFeedback({
        tone: "error",
        title: "Não foi possível enviar o diagnóstico",
        description:
          "Diagnóstico ativo não encontrado para este formulário. Atualize os dados e tente novamente.",
        retryAction: "reload",
      });
      return;
    }

    const isResubmission = currentPayload.cycle.state === "awaiting_adjustment";
    if (isResubmission) {
      const unresolvedAdjustments = unresolvedAdjustmentRows(currentPayload.rows);
      const unresolvedAdjustmentCount = countUnresolvedAdjustments(currentPayload.rows);
      if (unresolvedAdjustmentCount > 0) {
        if (!questionFocusMode) {
          focusQuestion(unresolvedAdjustments[0]?.questionId ?? null);
        }
        setFeedback({
          tone: "warning",
          title: "Conclua todas as correções antes do reenvio",
          description: questionFocusMode
            ? `Ainda há ${unresolvedAdjustmentCount} ${
                unresolvedAdjustmentCount === 1 ? "correção pendente" : "correções pendentes"
              }. Abra a visão completa do diagnóstico para concluir o reenvio.`
            : `Ainda há ${unresolvedAdjustmentCount} ${
                unresolvedAdjustmentCount === 1
                  ? "evidência devolvida sem substituição"
                  : "evidências devolvidas sem substituição"
              }. Envie uma nova evidência para cada devolutiva antes de reenviar.`,
        });
        return;
      }
    }

    const confirmed = await confirm({
      title: isResubmission
        ? "Reenviar correções para validação?"
        : "Enviar diagnóstico para validação?",
      description: isResubmission
        ? "As novas evidências serão encaminhadas à administração. As versões devolvidas permanecerão preservadas no histórico."
        : "Depois disso, as respostas seguirão para validação e você não poderá mais editá-las sem uma solicitação de ajuste.",
      confirmLabel: isResubmission ? "Reenviar correções" : "Enviar",
    });
    if (!confirmed) return;

    await submitCycleForValidation(cycleId, { isResubmission });
  }, [
    confirm,
    data,
    flushPendingRowsForSubmission,
    focusQuestion,
    loadWorkbenchData,
    mode,
    questionFocusMode,
    registerPendingEvidence,
    setFeedback,
    submitCycleForValidation,
  ]);

  const handleRetryFeedback = useCallback(async (feedback: WorkbenchFeedback | null) => {
    if (feedback?.retryAction === "submit") {
      const cycleId = data?.cycle.id;
      if (!cycleId) {
        await loadWorkbench();
        return;
      }
      await submitCycleForValidation(cycleId, {
        isResubmission: data.cycle.state === "awaiting_adjustment",
      });
      return;
    }
    await loadWorkbench();
  }, [data, loadWorkbench, submitCycleForValidation]);

  return { submittingForm, handleSubmitForm, handleRetryFeedback };
}
