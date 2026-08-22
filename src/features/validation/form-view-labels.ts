import type {
  FormAdminDecisionFilter,
  FormAnalysisSituation,
  FormAnswerFilter,
  FormCriterionVisualStatus,
  FormProofFilter,
  QueueSituationFilter,
} from "./form-view-types";

export const QUEUE_SITUATION_FILTER_LABEL: Record<QueueSituationFilter, string> = {
  pending: "Pendentes",
  awaiting_complement: "Aguardando complementação",
  completed: "Concluídos",
  all: "Todos os itens da fila",
};
export const FORM_ANSWER_FILTER_LABEL: Record<FormAnswerFilter, string> = {
  all: "Todas",
  yes: "Sim",
  no: "Não",
  not_applicable: "Não se aplica",
};
export const FORM_ANALYSIS_SITUATION_LABEL: Record<FormAnalysisSituation, string> = {
  all: "Todas",
  pending: "Pendente",
  completed: "Concluída",
  awaiting_complement: "Aguardando complementação",
  no_validation_needed: "Sem necessidade de validação",
};
export const FORM_ADMIN_DECISION_FILTER_LABEL: Record<FormAdminDecisionFilter, string> = {
  all: "Todas",
  none: "Sem decisão",
  approved: "Aprovada",
  validated_without_proof: "Validada sem comprovação",
  insufficient: "Insuficiente",
  not_applicable: "Não se aplica",
};
export const FORM_PROOF_FILTER_LABEL: Record<FormProofFilter, string> = {
  all: "Todas",
  with_documents: "Com comprovação",
  without_documents: "Sem comprovação",
  not_required: "Não exige evidência",
};
export const FORM_VISUAL_STATUS_LABEL: Record<FormCriterionVisualStatus, string> = {
  positive_evidence_approved: "Resposta positiva — evidência aprovada",
  positive_without_proof: "Resposta positiva — sem comprovação",
  negative: "Resposta negativa",
  na_respondent: "Não se aplica informado pelo respondente",
  na_admin: "Não se aplica definido na validação",
  awaiting_admin: "Aguardando decisão administrativa",
  analysis_complete: "Análise concluída",
};
