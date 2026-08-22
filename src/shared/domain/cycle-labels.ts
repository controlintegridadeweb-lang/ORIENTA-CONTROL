import type { CycleState } from "./types";

/**
 * Vocabulário de estados exibido para pessoas usuárias.
 *
 * `CycleState` continua sendo o contrato técnico do domínio e do banco; esta
 * camada impede que valores internos como `in_validation` vazem para a interface.
 */
export const CYCLE_STATE_LABEL: Record<CycleState, string> = {
  draft: "Rascunho",
  in_response: "Em preenchimento",
  submitted: "Enviado",
  in_validation: "Em validação",
  awaiting_adjustment: "Aguardando ajuste",
  validated: "Diagnóstico concluído",
  completed: "Avaliação encerrada",
};

export const ADMIN_CYCLE_STATE_LABEL: Record<CycleState, string> = {
  ...CYCLE_STATE_LABEL,
  awaiting_adjustment: "Aguardando correção do respondente",
};

export const RESPONDENT_CYCLE_STATE_LABEL: Record<CycleState, string> = {
  ...CYCLE_STATE_LABEL,
  awaiting_adjustment: "Correções solicitadas",
};

export function cycleStateLabel(state: string | null | undefined): string | null {
  if (!state) return null;
  return state in CYCLE_STATE_LABEL
    ? CYCLE_STATE_LABEL[state as CycleState]
    : null;
}

/** Rótulo seguro para mensagens de interface e respostas HTTP. */
export function cycleStateLabelOrFallback(state: string | null | undefined): string {
  return cycleStateLabel(state) ?? "Situação indisponível";
}

export function respondentCycleStateLabelOrFallback(
  state: string | null | undefined,
): string {
  if (!state) return "Situação indisponível";
  return state in RESPONDENT_CYCLE_STATE_LABEL
    ? RESPONDENT_CYCLE_STATE_LABEL[state as CycleState]
    : "Situação indisponível";
}
