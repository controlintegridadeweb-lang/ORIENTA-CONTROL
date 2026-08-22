"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { resolveCriterionAdministrativeActions } from "../administrative-actions";
import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
  UnifiedFormCriterion,
} from "@/features/validation";
import { evidenceVerdictToAbsentProofAction } from "../verdict-action-mapping";
import { evidenceFileUrl } from "@/features/evidences";
import { LoadingButton } from "@/shared/ui/components/loading";
import { notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { CriterionAdministrativeActions } from "./CriterionAdministrativeActions";
import { EVIDENCE_ACTION_LABEL } from "./evidence-card-config";

const ANSWER_LABEL = {
  yes: "Sim",
  no: "Não",
  not_applicable: "Não se aplica",
} as const;

const VISUAL_BADGE: Record<UnifiedFormCriterion["visualStatus"], string> = {
  positive_evidence_approved: formSurface.badge.success,
  positive_without_proof: formSurface.badge.info,
  negative: formSurface.badge.danger,
  na_respondent: formSurface.badge.warning,
  na_admin: formSurface.badge.warning,
  awaiting_admin: formSurface.badge.warning,
  analysis_complete: formSurface.badge.neutral,
};

const VERDICT_SUCCESS: Record<AbsentProofDecisionAction, string> = {
  validate_without_proof: "Resposta confirmada.",
  consider_insufficient: "Critério marcado como insuficiente.",
  request_proof: "Ajuste solicitado ao respondente.",
};

/**
 * Card para critérios sem grupo documental (ex.: resposta “Não”).
 * Visual alinhado ao EvidenceCard: sem faixa verde, sem FAMI e sem recomendação.
 */
export function ReadonlyCriterionCard({
  criterion,
  showSectionContext = true,
  onMarkAdminNotApplicable,
  onAbsentProofDecision,
  disabled = false,
}: {
  criterion: UnifiedFormCriterion;
  showSectionContext?: boolean;
  onMarkAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  onAbsentProofDecision?: (
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) => Promise<void>;
  disabled?: boolean;
}) {
  const documents = criterion.documents;
  const answerForNa =
    criterion.answer === "yes" || criterion.answer === "no"
      ? criterion.answer
      : null;

  const alreadyDecided =
    criterion.evidenceStatus === "considered_insufficient" ||
    criterion.evidenceStatus === "validated_without_proof" ||
    criterion.evidenceStatus === "proof_requested";
  const [changingDecision, setChangingDecision] = useState(false);
  const [action, setAction] = useState<EvidenceDecisionAction | null>(null);
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // “Não” do respondente não abre pendência; vereditos só ao alterar decisão prévia.
  const decisionOpen =
    criterion.answer === "no" &&
    criterion.allowsNotApplicable &&
    alreadyDecided &&
    changingDecision;

  const actions = resolveCriterionAdministrativeActions(
    {
      kind: "readonly",
      hasValidatableEvidence: false,
      absentProofDecisionOpen: false,
      negativeDecisionOpen: decisionOpen,
      allowsNotApplicable: criterion.allowsNotApplicable,
      answer: criterion.answer,
      adminApplicabilityStatus:
        criterion.notApplicableItem?.source === "admin"
          ? "not_applicable"
          : null,
    },
    {
      canValidateEvidence: false,
      canDecideAbsentProof: Boolean(onAbsentProofDecision) && !disabled,
      canMarkAdminNotApplicable:
        Boolean(onMarkAdminNotApplicable) && !disabled && answerForNa != null,
      canRequestProof: false,
    },
  );

  function cancel() {
    setAction(null);
    setObservation("");
    setError(null);
    if (alreadyDecided) setChangingDecision(false);
  }

  async function confirmVerdict() {
    if (!onAbsentProofDecision || !action) return;
    const mapped = evidenceVerdictToAbsentProofAction(action);
    const value = observation.trim();
    if (!value) {
      setError(
        action === "approve"
          ? "Informe a observação da validação."
          : "Informe a justificativa da decisão.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAbsentProofDecision(criterion.responseId, mapped, value);
      notify.success(VERDICT_SUCCESS[mapped]);
      cancel();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar a decisão.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const confirmation = action ? (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-slate-800">
          Confirmar: {EVIDENCE_ACTION_LABEL[action]}
        </h4>
        <p className="text-xs leading-relaxed text-slate-500">
          {criterion.questionPrompt}
        </p>
      </div>
      <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
        {action === "approve"
          ? "A resposta “Não” permanece registrada e a pendência administrativa é encerrada, sem classificar como “Não se aplica”."
          : action === "invalidate"
            ? "A resposta “Não” permanece registrada. O critério fica com 0 ponto e recomendação correspondente — distinto de “Não se aplica”."
            : "O critério será devolvido ao respondente para ajuste, preservando a resposta e o histórico."}
      </p>
      <label className={formSurface.fieldGroup}>
        <span className={formSurface.label}>
          {action === "approve"
            ? "Observação da validação"
            : "Justificativa da decisão"}{" "}
          <span className="text-rose-600">*</span>
        </span>
        <textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          rows={3}
          maxLength={2000}
          required
          disabled={disabled || submitting}
          className={formSurface.inputTextarea}
        />
      </label>
      {error ? (
        <p role="alert" className={formSurface.messageError}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          type="button"
          pending={submitting}
          pendingLabel="Registrando…"
          disabled={disabled || submitting || !observation.trim()}
          onClick={() => void confirmVerdict()}
          className={formSurface.primaryButtonSm}
        >
          Confirmar: {EVIDENCE_ACTION_LABEL[action]}
        </LoadingButton>
        <button
          type="button"
          disabled={submitting || disabled}
          onClick={cancel}
          className={formSurface.ghostButton}
        >
          Cancelar
        </button>
      </div>
    </div>
  ) : null;

  const hasOrder =
    Number.isFinite(criterion.orderIndex) &&
    criterion.orderIndex < Number.MAX_SAFE_INTEGER;

  return (
    <article className={`${formSurface.nestedCard} space-y-5`}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {hasOrder ? (
                <span
                  className={
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-md " +
                    "bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-700"
                  }
                >
                  {criterion.orderIndex + 1}
                </span>
              ) : null}
              {showSectionContext ? (
                <p className={typography.meta}>
                  {criterion.axisName} · {criterion.sectionName}
                </p>
              ) : null}
            </div>
            <h3
              className={`${showSectionContext || hasOrder ? "mt-1" : ""} ${formSurface.cardTitle}`}
            >
              {criterion.questionPrompt}
            </h3>
          </div>
          <span
            className={`${formSurface.badge.base} ${VISUAL_BADGE[criterion.visualStatus]} shrink-0`}
          >
            {criterion.visualStatusLabel}
          </span>
        </div>
      </header>

      <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div className={formSurface.fieldGroup}>
          <dt className={formSurface.label}>Resposta registrada</dt>
          <dd className="text-sm text-slate-700">
            {ANSWER_LABEL[criterion.answer]}
          </dd>
        </div>
        <div className={formSurface.fieldGroup}>
          <dt className={formSurface.label}>Exigência de evidência</dt>
          <dd className="text-sm text-slate-700">
            {criterion.requiresEvidence ? "Exige evidência" : "Não exige evidência"}
          </dd>
        </div>
        {criterion.respondentNote ? (
          <div className={`${formSurface.fieldGroup} sm:col-span-2`}>
            <dt className={formSurface.label}>
              {criterion.answer === "not_applicable"
                ? "Justificativa"
                : "Informação complementar"}
            </dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {criterion.respondentNote}
            </dd>
          </div>
        ) : null}
        {criterion.naJustification &&
        criterion.naJustification !== criterion.respondentNote ? (
          <div className={`${formSurface.fieldGroup} sm:col-span-2`}>
            <dt className={formSurface.label}>Observação do respondente</dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {criterion.naJustification}
            </dd>
          </div>
        ) : null}
      </dl>

      {documents.length > 0 ? (
        <div className="space-y-2">
          <p className={formSurface.label}>Comprovações apresentadas</p>
          <ul className="space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-slate-700">
                  {document.kind === "link"
                    ? document.externalLink ?? "Link externo"
                    : document.kind === "text"
                      ? document.title?.trim() ||
                        document.fileName?.trim() ||
                        "Texto"
                      : document.fileName ?? "Arquivo"}
                </span>
                {document.kind === "text" && document.textBody?.trim() ? (
                  <p className="w-full whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                    {document.textBody}
                  </p>
                ) : null}
                {document.kind === "file" ? (
                  <div className="flex gap-2">
                    <a
                      href={evidenceFileUrl(document.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Ver
                    </a>
                    <a
                      href={evidenceFileUrl(document.id, { download: true })}
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                      onClick={() => notify.info("Download iniciado.")}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Baixar
                    </a>
                  </div>
                ) : document.externalLink ? (
                  <a
                    href={document.externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    Abrir link
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {alreadyDecided && !changingDecision && onAbsentProofDecision && !disabled ? (
        <button
          type="button"
          onClick={() => setChangingDecision(true)}
          className={formSurface.secondaryButtonSm}
        >
          Alterar decisão
        </button>
      ) : null}

      {action && confirmation ? (
        <section
          className="space-y-3 border-t border-slate-100 pt-4"
          aria-label="Decisões administrativas"
        >
          {confirmation}
        </section>
      ) : actions.primaryActions.length > 0 || actions.canMarkNotApplicable ? (
        <CriterionAdministrativeActions
          actions={actions}
          disabled={disabled || submitting}
          validationDescription="Escolha o veredito deste critério. Justificativa é obrigatória para insuficiência ou ajuste."
          primary={
            actions.primaryActions.length > 0
              ? {
                  onSelect: (selected) => {
                    if (
                      selected === "approve" ||
                      selected === "invalidate" ||
                      selected === "request_adjustment"
                    ) {
                      setAction(selected);
                      setError(null);
                    }
                  },
                  activeAction: action,
                  choiceStyle: "evidence",
                }
              : undefined
          }
          markNotApplicable={
            actions.canMarkNotApplicable &&
            onMarkAdminNotApplicable &&
            answerForNa
              ? {
                  context: {
                    responseId: criterion.responseId,
                    questionPrompt: criterion.questionPrompt,
                    answer: answerForNa,
                    documents: criterion.documents,
                  },
                  onSubmit: onMarkAdminNotApplicable,
                  onOpen: () => setAction(null),
                }
              : null
          }
        />
      ) : (
        <p className="text-xs text-slate-500">
          {criterion.awaitsAdminAction
            ? "Aguardando decisão administrativa."
            : "Consulta do formulário — este critério não exige decisão administrativa neste momento."}
        </p>
      )}
    </article>
  );
}
