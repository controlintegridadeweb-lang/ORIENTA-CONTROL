import type {
  FormAdminDecisionFilter,
  FormAnalysisSituation,
  FormAnswerFilter,
  FormProofFilter,
  QueueSituationFilter,
} from "./form-view-types";

export function parseQueueSituationFilter(value: string | null | undefined): QueueSituationFilter {
  if (["todos", "all", "todos-itens", "fila"].includes(value ?? "")) return "all";
  if (["concluidos", "concluida", "completed", "analisados", "analyzed"].includes(value ?? "")) return "completed";
  if (["aguardando-complementacao", "awaiting_complement"].includes(value ?? "")) return "awaiting_complement";
  return "pending";
}
export function queueSituationFilterToParam(value: QueueSituationFilter): string {
  if (value === "all") return "todos-itens";
  if (value === "completed") return "concluidos";
  if (value === "awaiting_complement") return "aguardando-complementacao";
  return "pendente";
}
export function parseFormAnswerFilter(value: string | null | undefined): FormAnswerFilter {
  if (value === "yes" || value === "sim") return "yes";
  if (value === "no" || value === "nao" || value === "não") return "no";
  if (["not_applicable", "nao-se-aplica", "na"].includes(value ?? "")) return "not_applicable";
  return "all";
}
export function formAnswerFilterToParam(value: FormAnswerFilter): string | null {
  if (value === "all") return null;
  if (value === "yes") return "sim";
  if (value === "no") return "nao";
  return "nao-se-aplica";
}
export function parseFormAnalysisSituation(value: string | null | undefined): FormAnalysisSituation {
  if (value === "pendente" || value === "pending") return "pending";
  if (value === "concluida" || value === "completed") return "completed";
  if (["aguardando-complementacao", "awaiting_complement"].includes(value ?? "")) return "awaiting_complement";
  if (["sem-necessidade", "no_validation_needed"].includes(value ?? "")) return "no_validation_needed";
  return "all";
}
export function formAnalysisSituationToParam(value: FormAnalysisSituation): string | null {
  if (value === "all") return null;
  if (value === "pending") return "pendente";
  if (value === "completed") return "concluida";
  if (value === "awaiting_complement") return "aguardando-complementacao";
  return "sem-necessidade";
}
export function parseFormAdminDecisionFilter(value: string | null | undefined): FormAdminDecisionFilter {
  if (value === "none" || value === "sem-decisao") return "none";
  if (value === "approved" || value === "aprovada") return "approved";
  if (["validated_without_proof", "validada-sem-comprovacao"].includes(value ?? "")) return "validated_without_proof";
  if (value === "insufficient" || value === "insuficiente") return "insufficient";
  if (value === "not_applicable" || value === "nao-se-aplica") return "not_applicable";
  return "all";
}
export function formAdminDecisionFilterToParam(value: FormAdminDecisionFilter): string | null {
  if (value === "all") return null;
  if (value === "none") return "sem-decisao";
  if (value === "approved") return "aprovada";
  if (value === "validated_without_proof") return "validada-sem-comprovacao";
  if (value === "insufficient") return "insuficiente";
  return "nao-se-aplica";
}
export function parseFormProofFilter(value: string | null | undefined): FormProofFilter {
  if (value === "with_documents" || value === "com-documentos") return "with_documents";
  if (value === "without_documents" || value === "sem-documentos") return "without_documents";
  if (value === "not_required" || value === "nao-exige") return "not_required";
  return "all";
}
export function formProofFilterToParam(value: FormProofFilter): string | null {
  if (value === "all") return null;
  if (value === "with_documents") return "com-documentos";
  if (value === "without_documents") return "sem-documentos";
  return "nao-exige";
}
