import type { FormPublishPending, FormPublishReadiness } from "./publish-contract";

export type { FormPublishReadiness } from "./publish-contract";

/**
 * Avalia se um formulário está pronto para publicar (materializar uma
 * form_version a partir do rascunho).
 *
 * DEADLINE NÃO É CHECADO AQUI: prazo de resposta pertence ao CICLO
 * (cycles.response_deadline_at), definido na criação do ciclo — não ao
 * formulário/template. O bloqueio por ausência de prazo vive na abertura do
 * diagnóstico, não na publicação do template.
 *
 * Critérios de prontidão: nome, ao menos um critério no rascunho, binding de
 * biblioteca completo para cada critério e ao menos uma organização atribuída.
 */
export function evaluateFormPublishReadiness(input: {
  form: { name: string };
  questionCount: number;
  bindingPending: FormPublishPending[];
  assignmentCount: number;
}): FormPublishReadiness {
  const hasName = input.form.name.trim().length > 0;
  const hasQuestions = input.questionCount > 0;
  const bindingsComplete = input.bindingPending.length === 0 && hasQuestions;
  const hasAssignments = input.assignmentCount > 0;
  const canPublish = hasName && hasQuestions && bindingsComplete && hasAssignments;

  return {
    canPublish,
    pending: input.bindingPending,
    checks: { hasName, hasQuestions, bindingsComplete, hasAssignments },
    questionCount: input.questionCount,
    assignmentCount: input.assignmentCount,
  };
}
