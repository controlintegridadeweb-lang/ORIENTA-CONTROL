"use client";

import type { ReactNode } from "react";
import type { ResolvedCriterionAdministrativeActions } from "../administrative-actions";
import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
} from "../contracts";
import {
  AdminNotApplicableDecision,
  type AdminNotApplicableContext,
} from "./AdminNotApplicableDecision";
import {
  ABSENT_ACTION_LABEL,
  administrativeDecisionButtonClass,
  EVIDENCE_ACTION_LABEL,
} from "./evidence-card-config";

type PrimaryActionHandler = {
  onSelect: (
    action: EvidenceDecisionAction | AbsentProofDecisionAction,
  ) => void;
  activeAction?: EvidenceDecisionAction | AbsentProofDecisionAction | null;
  /** Destaque de seleção unificado (mesmo estilo dos cards com documento). */
  choiceStyle?: "evidence" | "absent";
};

function primaryActionLabel(
  action: EvidenceDecisionAction | AbsentProofDecisionAction,
): string {
  if (
    action === "approve" ||
    action === "invalidate" ||
    action === "request_adjustment"
  ) {
    return EVIDENCE_ACTION_LABEL[action];
  }
  return ABSENT_ACTION_LABEL[action];
}

/**
 * Rodapé de decisões administrativas do critério (sem documento / leitura).
 * Não misturar com “Decisão sobre esta evidência” do card documental.
 *
 * Estrutura:
 * Título administrativo
 * texto de apoio
 * [ações do critério]
 * ------------------------------------------------
 * [Marcar como “Não se aplica”] — quando elegível
 */
export function CriterionAdministrativeActions({
  actions,
  primary,
  markNotApplicable,
  disabled = false,
  confirmation,
  className,
  validationTitle = "Validação",
  validationDescription = "Escolha o veredito. Justificativa é obrigatória para insuficiência ou ajuste.",
  showValidationIntro = true,
}: {
  actions: ResolvedCriterionAdministrativeActions;
  primary?: PrimaryActionHandler;
  markNotApplicable?: {
    context: AdminNotApplicableContext;
    onSubmit: (responseId: string, justification: string) => Promise<void>;
    onOpen?: () => void;
  } | null;
  disabled?: boolean;
  confirmation?: ReactNode;
  className?: string;
  validationTitle?: string;
  validationDescription?: string;
  /** Quando false, omite título/texto (ex.: intro já renderizado pelo pai). */
  showValidationIntro?: boolean;
}) {
  const showPrimary =
    actions.primaryActions.length > 0 && primary !== undefined;
  const showNotApplicable =
    actions.canMarkNotApplicable && markNotApplicable != null;

  if (!showPrimary && !showNotApplicable && !confirmation) {
    return null;
  }

  const Wrapper = showValidationIntro ? "section" : "div";
  const wrapperAriaLabel = showValidationIntro
    ? showNotApplicable && !showPrimary
      ? "Decisão administrativa do critério"
      : showPrimary && !showNotApplicable
        ? validationTitle
        : "Decisões administrativas"
    : undefined;

  return (
    <Wrapper
      className={className ?? "space-y-3 border-t border-slate-100 pt-4"}
      aria-label={wrapperAriaLabel}
    >
      {showPrimary && showValidationIntro ? (
        <div>
          <h5 className="text-sm font-semibold text-slate-800">
            {validationTitle}
          </h5>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {validationDescription}
          </p>
        </div>
      ) : null}

      {showPrimary ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.primaryActions.map((action) => {
            const isActive = primary?.activeAction === action;
            return (
              <button
                key={action}
                type="button"
                disabled={disabled}
                aria-pressed={isActive}
                onClick={() => primary?.onSelect(action)}
                className={`${administrativeDecisionButtonClass(
                  action,
                  Boolean(isActive),
                )} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {primaryActionLabel(action)}
              </button>
            );
          })}
        </div>
      ) : null}

      {confirmation}

      {showNotApplicable ? (
        <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
          <p className="text-xs leading-relaxed text-slate-500">
            A resposta original será preservada no histórico.
          </p>
          <AdminNotApplicableDecision
            context={markNotApplicable.context}
            onSubmit={markNotApplicable.onSubmit}
            disabled={disabled}
            onOpen={markNotApplicable.onOpen}
          />
        </div>
      ) : null}
    </Wrapper>
  );
}
