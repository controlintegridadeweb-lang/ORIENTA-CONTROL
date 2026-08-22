"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { type WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import type { YesEvidenceFieldErrors } from "@/features/workbench/validate-yes-evidence";
import {
  canSaveYesEvidenceDraft,
  validateYesEvidenceDraftForRow,
} from "@/features/workbench/validate-evidence-draft";
import { perguntaLabels } from "@/shared/labels/official-labels";

import {
  EvidenceStatusMessage,
  resolveEvidenceStatus,
  resolvePendingModality,
} from "./evidence-rule-message";
import { EvidenceDetails, NotApplicableDetails } from "./respondent-question-details";
import { resolvePersistedEvidences } from "./resolve-persisted-evidences";
import { CriterionAutosaveIndicator } from "./criterion-autosave-indicator";
import { CriterionScore } from "@/features/forms";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { CriterionAutosaveState } from "../criterion-answer-autosave";

export type { EvidenceDraft } from "@/features/workbench/evidence-draft";

export type RespondentSectionGroup = {
  name: string;
  rows: WorkbenchRow[];
};

/** Exibe upload/link/título quando Sim exige comprovação (salvo ou em seleção local). */
export function shouldShowEvidenceUI(
  row: WorkbenchRow,
  options?: { pendingYes?: boolean },
): boolean {
  if (!row.requiresEvidence) return false;
  return row.answer === "yes" || options?.pendingYes === true;
}

/**
 * Valor visualmente selecionado: opções são mutuamente exclusivas.
 * `pendingYes` / `pendingNa` prevalecem sobre a resposta já salva.
 */
export function effectiveAnswerSelection(
  row: Pick<WorkbenchRow, "answer">,
  options?: { pendingYes?: boolean; pendingNa?: boolean },
): WorkbenchRow["answer"] {
  if (options?.pendingYes) return "yes";
  if (options?.pendingNa) return "not_applicable";
  return row.answer;
}

/** Exibe bloco de justificativa quando N/A está selecionado (salvo ou pendente local). */
export function shouldShowNaJustificationUI(
  row: Pick<WorkbenchRow, "answer">,
  options?: { pendingNa?: boolean },
): boolean {
  return row.answer === "not_applicable" || options?.pendingNa === true;
}

const ANSWER_OPTIONS: { value: "yes" | "no" | "not_applicable"; label: string }[] = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
  { value: "not_applicable", label: perguntaLabels.notApplicableInDiagnosis },
];

function axisLabelForSection(rows: WorkbenchRow[]): string | null {
  const axes = new Set(rows.map((r) => r.axisName).filter(Boolean));
  if (axes.size === 1) return [...axes][0] ?? null;
  return null;
}

/** Mantém os nomes públicos usados pelas superfícies e testes existentes. */
export const canSubmitYesWithEvidence = canSaveYesEvidenceDraft;
export const validateYesWithEvidenceForRow = validateYesEvidenceDraftForRow;

export type RespondentQuestionInteractionProps = {
  evidenceDrafts: Record<string, EvidenceDraft>;
  onEvidenceDraftChange: (questionId: string, patch: Partial<EvidenceDraft>) => void;
  onEvidenceAttachmentChange?: (
    questionId: string,
    clientId: string,
    patch: { title?: string; description?: string },
  ) => void;
  onEvidenceKindChange: (row: WorkbenchRow, kind: "file" | "link" | "text") => void | Promise<void>;
  onFileSelected: (row: WorkbenchRow, files: File | File[]) => void;
  onRemoveAttachment?: (
    row: WorkbenchRow,
    attachment?: { evidenceId?: string; pendingUploadId?: string; clientId?: string },
  ) => void | Promise<void>;
  onSelectAnswer: (row: WorkbenchRow, value: "yes" | "no" | "not_applicable") => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Em devolução, somente evidências das perguntas marcadas podem ser alteradas. */
  adjustmentMode?: boolean;
  activeQuestionId?: string | null;
  uploadingQuestionId?: string | null;
  pendingYesQuestionIds?: ReadonlySet<string>;
  pendingNaQuestionIds?: ReadonlySet<string>;
  naJustificationDrafts?: Record<string, string>;
  naFieldErrors?: Record<string, string>;
  onNaJustificationChange?: (questionId: string, value: string) => void;
  onSaveNaJustification?: (row: WorkbenchRow) => Promise<boolean>;
  onSaveYesWithEvidence?: (row: WorkbenchRow) => Promise<boolean>;
  evidenceFieldErrors?: Record<string, YesEvidenceFieldErrors>;
  autosaveStatuses?: Record<string, CriterionAutosaveState>;
  onRetryAutosave?: (questionId: string) => void | Promise<boolean>;
  /** Estado do diagnóstico — contextualiza instruções editáveis vs. apenas leitura da regra. */
  diagnosisStatus?: string | null;
};

type SectionQuestionsProps = RespondentQuestionInteractionProps & {
  section: RespondentSectionGroup;
  sectionIndex: number;
  /** Ex.: "Seção 1 de 3" — integrado ao cabeçalho da seção. */
  stepLabel: string;
};

/** Perguntas de uma única seção (usado pelo wizard de etapas). */
export function RespondentSectionQuestions({
  section,
  sectionIndex,
  stepLabel,
  evidenceDrafts,
  onEvidenceDraftChange,
  onEvidenceAttachmentChange,
  onEvidenceKindChange,
  onFileSelected,
  onRemoveAttachment,
  onSelectAnswer,
  disabled,
  readOnly,
  adjustmentMode,
  activeQuestionId,
  uploadingQuestionId,
  pendingYesQuestionIds,
  pendingNaQuestionIds,
  naJustificationDrafts,
  naFieldErrors,
  onNaJustificationChange,
  onSaveNaJustification,
  onSaveYesWithEvidence,
  evidenceFieldErrors,
  autosaveStatuses,
  onRetryAutosave,
  diagnosisStatus = null,
}: SectionQuestionsProps) {
  const ws = formSurface.formWorkspace;
  const sectionAxis = axisLabelForSection(section.rows);
  const sectionId = useMemo(
    () => `section-${sectionIndex}-${section.name.replace(/\s+/g, "-")}`,
    [sectionIndex, section.name],
  );

  return (
    <section
      key={sectionId}
      data-workbench-section
      aria-labelledby={sectionId}
      className="scroll-mt-[calc(var(--header-h)+5rem)]"
    >
      <header className={ws.sectionHeader}>
        <div className={ws.sectionStepRow}>
          <span className={ws.sectionStepKicker}>{stepLabel}</span>
        </div>
        <div>
          <h2 id={sectionId} className={ws.sectionTitle}>
            {section.name}
          </h2>
          {sectionAxis ? <p className="mt-1.5 text-sm text-slate-500">{sectionAxis}</p> : null}
        </div>
      </header>

      {readOnly ? (
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Consulta somente leitura. Respostas e evidências não podem ser alteradas neste estado.
        </p>
      ) : null}

      <ol className={ws.questionsList}>
        {section.rows.map((row, index) => {
                const persistedEvidences = resolvePersistedEvidences(row);
                const draft: EvidenceDraft =
                  evidenceDrafts[row.questionId] ??
                  ({
                    kind: persistedEvidences.length
                      ? null
                      : row.storagePath
                        ? "file"
                        : row.externalLink
                          ? "link"
                          : row.textBody
                            ? "text"
                            : null,
                    title: persistedEvidences.length ? "" : (row.evidenceTitle ?? ""),
                    description: persistedEvidences.length ? "" : (row.evidenceDescription ?? ""),
                    externalLink: persistedEvidences.length ? "" : (row.externalLink ?? ""),
                    storagePath: persistedEvidences.length ? null : (row.storagePath ?? null),
                    pendingUploadId: null,
                    textBody: persistedEvidences.length ? "" : (row.textBody ?? ""),
                    attachments: [],
                  } satisfies EvidenceDraft);
                const pendingYes = pendingYesQuestionIds?.has(row.questionId) ?? false;
                const pendingNa = pendingNaQuestionIds?.has(row.questionId) ?? false;
                const fieldErrors = evidenceFieldErrors?.[row.questionId];
                const showEvidence = shouldShowEvidenceUI(row, { pendingYes });
                const showNaJustification = shouldShowNaJustificationUI(row, {
                  pendingNa,
                });
                const selectedAnswer = effectiveAnswerSelection(row, {
                  pendingYes,
                  pendingNa,
                });
                const naDraft =
                  naJustificationDrafts?.[row.questionId] ??
                  row.naJustification ??
                  row.notes ??
                  "";
                const naError = naFieldErrors?.[row.questionId];
                const isBusy = activeQuestionId === row.questionId;
                const isUploading = uploadingQuestionId === row.questionId;
                const hasAdjustmentRequest = Boolean(row.hasAdjustmentRequest);
                const rowLockedForAdjustment = Boolean(adjustmentMode && !hasAdjustmentRequest);
                const rowLockedForPartialReopen = row.respondentEditable === false;
                const rowDisabled = Boolean(
                  disabled || rowLockedForAdjustment || rowLockedForPartialReopen,
                );
                const answerDisabled = Boolean(
                  disabled || adjustmentMode || rowLockedForPartialReopen,
                );
                const autosaveState = autosaveStatuses?.[row.questionId];
                const answerOptions = ANSWER_OPTIONS;
                const choiceCols =
                  answerOptions.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

                return (
                  <li key={row.questionId} id={`pergunta-${row.questionId}`} className={ws.questionCard}>
                    <div className="space-y-3">
                      <p className={typography.meta}>
                        {perguntaLabels.singular} {index + 1}
                        {!sectionAxis && row.axisName ? (
                          <>
                            <span className="mx-1.5 text-slate-300" aria-hidden>
                              ·
                            </span>
                            {row.axisName}
                          </>
                        ) : null}
                      </p>

                      <p className={ws.questionPrompt}>{row.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {rowLockedForPartialReopen ? (
                          <span
                            className={`${formSurface.badge.base} ${formSurface.badge.warning}`}
                          >
                            Fora do escopo da reabertura
                          </span>
                        ) : null}
                        {row.requiresEvidence ? (
                          <span
                            className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
                          >
                            Exige evidência
                          </span>
                        ) : null}
                        <CriterionScore
                          answer={selectedAnswer}
                          requiresEvidence={row.requiresEvidence}
                          evidenceStatus={resolveEvidenceStatus(row)}
                          famiEnabled={row.famiEnabled}
                          diagnosisStatus={diagnosisStatus}
                        />
                        {!row.famiEnabled ? (
                          <span
                            className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
                          >
                            Não compõe o FAMI
                          </span>
                        ) : null}
                      </div>
                      <EvidenceStatusMessage
                        answer={selectedAnswer}
                        evidenceRequired={row.requiresEvidence}
                        evidenceStatus={resolveEvidenceStatus(row)}
                        diagnosisStatus={diagnosisStatus}
                        pendingModality={resolvePendingModality(row)}
                      />
                    </div>

                    {adjustmentMode ? (
                      <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                        hasAdjustmentRequest
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>
                        {hasAdjustmentRequest
                          ? row.proofRequested && !row.evidences?.some((item) => item.validationStatus === "adjustment_requested")
                            ? "A administração solicitou a comprovação deste critério. Envie a evidência; a resposta permanece bloqueada."
                            : (row.adjustmentRequestCount ?? 1) > 1
                              ? `A administração solicitou a correção de ${row.adjustmentRequestCount} pendências desta pergunta. Envie uma nova evidência para cada devolutiva; a resposta permanece bloqueada.`
                              : "A administração solicitou correção da evidência desta pergunta. A resposta permanece bloqueada."
                          : "Nenhum ajuste foi solicitado nesta pergunta. Conteúdo disponível somente para consulta."}
                      </p>
                    ) : null}

                    <fieldset className="mt-5">
                      <legend className="sr-only">Sua resposta</legend>
                      <div className={`grid grid-cols-1 gap-2 ${choiceCols}`}>
                        {answerOptions.map((opt) => {
                          const selected = selectedAnswer === opt.value;
                          const inputId = `answer-${row.questionId}-${opt.value}`;
                          return (
                            <label
                              key={opt.value}
                              htmlFor={inputId}
                              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand ${
                                selected
                                  ? "border-brand-400 bg-brand-50 text-brand-900"
                                  : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/90"
                              } ${answerDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                            >
                              <input
                                id={inputId}
                                type="radio"
                                name={`answer-${row.questionId}`}
                                value={opt.value}
                                checked={selected}
                                disabled={answerDisabled}
                                onChange={() => onSelectAnswer(row, opt.value)}
                                className="sr-only"
                              />
                              {selected ? (
                                <Check className="h-4 w-4 text-brand-600" aria-hidden />
                              ) : null}
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                      <CriterionAutosaveIndicator
                        state={autosaveState}
                        errorId={`autosave-error-${row.questionId}`}
                        onRetry={
                          onRetryAutosave
                            ? () => void onRetryAutosave(row.questionId)
                            : undefined
                        }
                      />
                    </fieldset>

                    <NotApplicableDetails
                      row={row}
                      visible={showNaJustification}
                      pending={pendingNa}
                      draft={naDraft}
                      error={naError}
                      disabled={rowDisabled || adjustmentMode}
                      busy={isBusy}
                      readOnly={readOnly || adjustmentMode}
                      onChange={onNaJustificationChange}
                      onSave={onSaveNaJustification}
                    />

                    <EvidenceDetails
                      row={row}
                      visible={showEvidence}
                      draft={draft}
                      pending={pendingYes}
                      fieldErrors={fieldErrors}
                      disabled={rowDisabled}
                      busy={isBusy}
                      uploading={isUploading}
                      onDraftChange={onEvidenceDraftChange}
                      onAttachmentChange={onEvidenceAttachmentChange}
                      onKindChange={onEvidenceKindChange}
                      onFileSelected={onFileSelected}
                      onRemoveAttachment={onRemoveAttachment}
                      onSaveResponse={readOnly ? undefined : onSaveYesWithEvidence}
                    />
                  </li>
                );
              })}
      </ol>
    </section>
  );
}
