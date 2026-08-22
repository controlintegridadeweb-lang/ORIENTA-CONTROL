"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, SendHorizontal } from "lucide-react";
import { RespondentSectionNavigation } from "@/features/workbench/components/respondent-form/respondent-section-navigation";
import { RespondentSectionWizard } from "@/features/workbench/components/respondent-form/respondent-section-wizard";
import { formSurface } from "@/shared/layout/form-surface";
import { respondentCyclePath } from "@/shared/navigation/respondent-navigation-context";
import { countUnresolvedAdjustments } from "@/features/workbench/adjustment-progress";
import type { Mode } from "./workbench-helpers";
import { WorkbenchFeedbackBanner } from "./workbench-feedback";
import { useWorkbench } from "./use-workbench";

export function WorkbenchShell({
  mode,
  initialCycleId,
  /** Se true, busca as perguntas ao abrir a tela (fluxo "Responder" do respondente). */
  autoLoad = false,
  /** Rola até a pergunta ao abrir (ex.: link "Corrigir evidência"). */
  initialFocusQuestionId,
  readOnly = false,
  readOnlyMessage,
  submissionReturnTo,
}: {
  mode: Mode;
  initialCycleId?: string;
  autoLoad?: boolean;
  initialFocusQuestionId?: string;
  /** Exibe o diagnóstico para acompanhamento, sem respostas ou alterações de evidência. */
  readOnly?: boolean;
  readOnlyMessage?: string;
  submissionReturnTo?: string;
}) {
  const ids = useMemo(() => ({ cycleId: initialCycleId ?? "" }), [initialCycleId]);
  const canAutoLoad = Boolean(autoLoad && initialCycleId);
  const simplifiedRespondent = Boolean(autoLoad && initialCycleId);

  const {
    data,
    feedback,
    loading,
    savingQuestionId,
    uploadingQuestionId,
    evidenceDrafts,
    submittingForm,
    pendingYesQuestionIds,
    pendingNaQuestionIds,
    naJustificationDrafts,
    naFieldErrors,
    evidenceFieldErrors,
    autosaveStatuses,
    retryAutosave,
    currentSectionIndex,
    stepDirection,
    advancingSection,
    groupedBySection,
    questionFocusMode,
    updateEvidenceDraft,
    updateEvidenceAttachment,
    handleEvidenceKindChange,
    handleRemoveEvidence,
    handleEvidenceFile,
    handleSelectAnswer,
    updateNaJustification,
    saveNaJustification,
    saveYesWithEvidence,
    handleSectionContinue,
    handleSectionBack,
    handleSectionSelect,
    handleReadOnlySectionNext,
    handleSubmitForm,
    handleRetryFeedback,
  } = useWorkbench({
    mode,
    ids,
    canAutoLoad,
    simplifiedRespondent,
    initialFocusQuestionId,
    submissionReturnTo,
  });

  if (simplifiedRespondent) {
    const sectionCount = groupedBySection.length;
    const isLastSection = currentSectionIndex >= sectionCount - 1;
    const navBusy = Boolean(
      advancingSection || uploadingQuestionId || submittingForm,
    );
    const ws = formSurface.formWorkspace;
    const hasRows = Boolean(data && (data.rows?.length ?? 0) > 0);
    const adjustmentMode = data?.cycle.state === "awaiting_adjustment";
    const unresolvedAdjustmentCount = adjustmentMode
      ? countUnresolvedAdjustments(data?.rows ?? [])
      : 0;
    const otherAdjustmentCount = questionFocusMode
      ? countUnresolvedAdjustments(data?.rows ?? [], initialFocusQuestionId)
      : 0;
    const allPendenciesHref = initialCycleId
      ? respondentCyclePath(initialCycleId, submissionReturnTo)
      : null;

    return (
      <>
        {hasRows && !questionFocusMode ? (
          <RespondentSectionNavigation
            sections={groupedBySection}
            currentSectionIndex={currentSectionIndex}
            evidenceDrafts={evidenceDrafts}
            pendingYesQuestionIds={pendingYesQuestionIds}
            pendingNaQuestionIds={pendingNaQuestionIds}
            naJustificationDrafts={naJustificationDrafts}
            adjustmentMode={adjustmentMode}
            disabled={navBusy}
            onSelect={handleSectionSelect}
          />
        ) : null}

        <div className={ws.body}>
          {feedback && !(loading && !data) ? (
            <WorkbenchFeedbackBanner
              feedback={feedback}
              retrying={feedback.retryAction === "submit" ? submittingForm : loading}
              onRetry={feedback.retryAction ? handleRetryFeedback : undefined}
            />
          ) : null}

          {adjustmentMode && !readOnly && !questionFocusMode ? (
            <div role="status" className={`${formSurface.messageWarning} mb-4`}>
              <p className="font-medium">Correções solicitadas</p>
              <p className="mt-1 text-xs">
                Somente as perguntas com ajuste de evidência ou comprovação solicitada podem ser alteradas. As demais respostas permanecem disponíveis para consulta.
              </p>
            </div>
          ) : null}

          {questionFocusMode && !readOnly ? (
            <div role="status" className={`${formSurface.messageWarning} mb-4`}>
              <p className="font-medium">Correção de evidência</p>
              <p className="mt-1 text-xs">
                Você está vendo apenas a pergunta com ajuste solicitado.
                {otherAdjustmentCount > 0
                  ? ` Há mais ${otherAdjustmentCount} ${
                      otherAdjustmentCount === 1
                        ? "correção pendente"
                        : "correções pendentes"
                    } neste diagnóstico — resolva todas antes de reenviar.`
                  : null}
              </p>
            </div>
          ) : null}

          {readOnly ? (
            <div role="status" className={formSurface.messageNeutral}>
              <span className="font-medium text-slate-800">Acompanhamento do diagnóstico.</span>{" "}
              {readOnlyMessage ?? "As informações abaixo estão disponíveis apenas para consulta."}
            </div>
          ) : null}

          {loading && !data ? (
            <div className="space-y-6" aria-hidden>
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="h-3 w-1/4 rounded bg-slate-200" />
                  <div className="h-4 w-full max-w-lg rounded bg-slate-200" />
                  <div className="h-10 w-full max-w-sm rounded-lg bg-slate-200" />
                </div>
              ))}
            </div>
          ) : null}

          {data && (data.rows?.length ?? 0) === 0 && !loading ? (
            <p className="text-center text-sm text-slate-500">
              Não há perguntas configuradas neste formulário.
            </p>
          ) : null}

          {hasRows ? (
            <RespondentSectionWizard
              groupedBySection={groupedBySection}
              currentSectionIndex={currentSectionIndex}
              stepDirection={stepDirection}
              evidenceDrafts={evidenceDrafts}
              onEvidenceDraftChange={updateEvidenceDraft}
              onEvidenceAttachmentChange={updateEvidenceAttachment}
              onEvidenceKindChange={handleEvidenceKindChange}
              onFileSelected={handleEvidenceFile}
              onRemoveAttachment={handleRemoveEvidence}
              onSelectAnswer={handleSelectAnswer}
              disabled={readOnly || loading || advancingSection}
              readOnly={readOnly}
              adjustmentMode={adjustmentMode}
              activeQuestionId={savingQuestionId}
              uploadingQuestionId={uploadingQuestionId}
              pendingYesQuestionIds={pendingYesQuestionIds}
              pendingNaQuestionIds={pendingNaQuestionIds}
              naJustificationDrafts={naJustificationDrafts}
              naFieldErrors={naFieldErrors}
              onNaJustificationChange={updateNaJustification}
              onSaveNaJustification={saveNaJustification}
              onSaveYesWithEvidence={saveYesWithEvidence}
              evidenceFieldErrors={evidenceFieldErrors}
              autosaveStatuses={autosaveStatuses}
              onRetryAutosave={retryAutosave}
              diagnosisStatus={data?.cycle.state}
            />
          ) : null}
        </div>

        {hasRows ? (
          <div className={`${ws.footer} flex flex-col gap-3`}>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleSectionBack}
                disabled={currentSectionIndex <= 0 || navBusy}
                className={`${formSurface.secondaryButton} inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-35`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Seção anterior
              </button>

              {readOnly ? (
                !isLastSection ? (
                  <button
                    type="button"
                    onClick={handleReadOnlySectionNext}
                    disabled={navBusy}
                    className={`${formSurface.primaryButton} inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-45`}
                  >
                    Próxima seção
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null
              ) : !isLastSection ? (
                <button
                  type="button"
                  onClick={() => void handleSectionContinue()}
                  disabled={navBusy}
                  className={`${formSurface.primaryButton} inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-45`}
                >
                  {advancingSection ? "Avançando…" : "Continuar"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              ) : questionFocusMode && otherAdjustmentCount > 0 && allPendenciesHref ? (
                <Link
                  href={allPendenciesHref}
                  className={`${formSurface.primaryButton} inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-50`}
                >
                  Ver todas as pendências
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSubmitForm()}
                  disabled={
                    navBusy ||
                    (questionFocusMode && unresolvedAdjustmentCount > 0)
                  }
                  className={`${formSurface.primaryButton} inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-50`}
                >
                  <SendHorizontal className="h-4 w-4" aria-hidden />
                  {submittingForm
                    ? adjustmentMode
                      ? "Reenviando…"
                      : "Enviando…"
                    : questionFocusMode && unresolvedAdjustmentCount > 0
                      ? "Conclua esta correção"
                      : adjustmentMode && unresolvedAdjustmentCount > 0
                        ? `Concluir ${unresolvedAdjustmentCount} ${
                            unresolvedAdjustmentCount === 1
                              ? "correção pendente"
                              : "correções pendentes"
                          }`
                        : adjustmentMode
                        ? "Revisar e reenviar correções"
                        : "Revisar e enviar diagnóstico"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <p className={formSurface.messageNeutral}>
      Abra o diagnóstico pelo fluxo do respondente para responder às perguntas.
    </p>
  );
}
