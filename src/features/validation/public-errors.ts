export type ValidationFailureCode =
  | "validation_conflict"
  | "evidence_not_found"
  | "evidence_not_in_cycle"
  | "response_not_found"
  | "response_not_in_cycle"
  | "response_not_reviewable_na"
  | "justification_required"
  | "na_rejection_reason_required"
  | "cycle_not_in_validation"
  | "invalid_action"
  | "question_not_eligible"
  | "admin_applicability_requires_yes_or_no"
  | "admin_applicability_already_marked"
  | "admin_na_justification_required"
  | "admin_applicability_failed"
  | "validation_failed";

const PUBLIC_MESSAGE: Record<ValidationFailureCode, string> = {
  validation_conflict:
    "O parecer foi alterado por outro administrador. A fila foi atualizada; revise o estado atual e tente novamente.",
  evidence_not_found: "A evidência não está mais disponível na fila.",
  evidence_not_in_cycle: "A evidência não pertence a este diagnóstico.",
  response_not_found: "A resposta não está mais disponível na fila.",
  response_not_in_cycle: "A resposta não pertence a este diagnóstico.",
  response_not_reviewable_na:
    "A resposta não possui mais um parecer “não se aplica” revisável.",
  justification_required: "Informe a justificativa para esta decisão.",
  na_rejection_reason_required: "Informe o motivo da rejeição.",
  cycle_not_in_validation:
    "O diagnóstico não está mais disponível para validação.",
  invalid_action: "A decisão selecionada não é válida.",
  question_not_eligible:
    "Este critério não permite a classificação administrativa “Não se aplica”.",
  admin_applicability_requires_yes_or_no:
    "Somente respostas “Sim” ou “Não” podem receber “Não se aplica” administrativo.",
  admin_applicability_already_marked:
    "Este critério já possui classificação administrativa “Não se aplica”.",
  admin_na_justification_required: "Informe a justificativa da decisão.",
  admin_applicability_failed:
    "Não foi possível classificar o critério como “Não se aplica”.",
  validation_failed:
    "Não foi possível registrar o parecer. Atualize a fila e tente novamente.",
};

export function validationFailureMessage(code: string | null | undefined): string {
  if (code && code in PUBLIC_MESSAGE) {
    return PUBLIC_MESSAGE[code as ValidationFailureCode];
  }
  return PUBLIC_MESSAGE.validation_failed;
}
