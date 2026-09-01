import type { CycleState } from "./types";

/**
 * Máquina de estados do Ciclo institucional.
 *
 * NOTA ARQUITETURAL:
 * Estes estados pertencem ao CICLO (form × organization × período), não ao
 * Formulário-template. A fonte de verdade é `cycles.state` (tabela `cycles`,
 * chave natural `form_id × organization_id`). `forms.state` é apenas um
 * marcador derivado de publicação — não é a fonte de verdade do fluxo de
 * negócio. Ver `CycleIdentity` em `types.ts`.
 *
 * Grupos funcionais:
 *  CONSTRUÇÃO  │ draft
 *  RESPOSTA    │ in_response → submitted → awaiting_adjustment
 *  VALIDAÇÃO   │ in_validation
 *  DIAGNÓSTICO │ validated          ← validação concluída; FAMI oficial congelado
 *  ENCERRADO   │ completed          ← ciclo de acompanhamento encerrado
 */
const transitions: Record<CycleState, CycleState[]> = {
  draft: ["in_response"],
  in_response: ["submitted"],
  submitted: ["in_validation"],
  in_validation: ["awaiting_adjustment", "validated"],
  awaiting_adjustment: ["in_validation"],
  // `validated` = diagnóstico concluído e FAMI oficial disponível. A aresta
  // seguinte encerra somente o ciclo de acompanhamento.
  validated: ["completed"],
  completed: [],
};
// NOTA: as 7 arestas acima são as de AVANÇO canônicas (6.4). As reaberturas
// excepcionais ficam fora deste mapa:
//   • completed → in_response     (reopen_cycle — recoleta do respondente)
//   • validated → in_validation   (reopen_validation_cycle — só a validação)
// A correção pós-envio usa `in_validation → awaiting_adjustment`
// ("Solicitar ajuste"), não um retorno a draft. Paridade com a guarda SQL
// `cycle_can_transition` (migration 0010) + exceções em
// `enforce_cycle_transition_integrity` na baseline canônica.

/**
 * Transições INTERMEDIÁRIAS ADMINISTRATIVAS — as que avançam o ciclo SEM efeito
 * colateral de fronteira e podem aparecer na rota administrativa de transição.
 *
 * NÃO inclui as fronteiras, que têm fluxo dedicado por carregarem efeitos que a
 * transição genérica não pode reproduzir:
 *   • draft → in_response      "abrir ciclo" (exige período/datas)         → /open
 *   • in_response → submitted  "enviar"      (ação do respondente)         → /submit
 *   • awaiting_adjustment → in_validation     (reenvio do respondente)      → /submit
 *   • validated → completed    "encerrar ciclo" (FAMI já congelado na validação) → /close
 *   • completed → in_response   "reabrir"     (novo processing, +reopen)     → /reopen
 */
export const INTERMEDIATE_TRANSITION_LABELS: Partial<
  Record<`${CycleState}->${CycleState}`, string>
> = {
  "submitted->in_validation": "Iniciar validação",
  "in_validation->awaiting_adjustment": "Solicitar ajuste",
  "in_validation->validated": "Concluir validação",
};

/**
 * Arestas cuja decisão pertence exclusivamente ao respondente.
 *
 * Elas passam pelo endpoint dedicado de envio, que valida completude das
 * respostas e evidências antes de alterar o estado. Mantê-las identificadas no
 * domínio impede que uma rota administrativa ou uma transição genérica crie um
 * caminho paralelo sem essas pré-condições.
 */
const RESPONDENT_SUBMISSION_TRANSITIONS = new Set<`${CycleState}->${CycleState}`>([
  "in_response->submitted",
  "awaiting_adjustment->in_validation",
]);

export function isRespondentSubmissionTransition(
  from: CycleState,
  to: CycleState,
): boolean {
  return RESPONDENT_SUBMISSION_TRANSITIONS.has(`${from}->${to}`);
}

/**
 * Efeito colateral de cada aresta com tratamento especial, usado pelo ENDPOINT
 * ÚNICO de transição (6.4) para despachar internamente — não implica rotas
 * separadas. As intermediárias (não listadas aqui) só transicionam.
 *   • open               draft→in_response   exige starts_at + response_deadline_at
 *   • close              validated→completed encerra o ciclo; não recalcula o FAMI
 *   • reopen             completed→in_response cria novo processing (+reopen_count)
 *   • reopen_validation  validated→in_validation preserva decisões e FAMI histórico
 * (in_response→submitted é ação do respondente, fora do endpoint admin.)
 */
export type CycleTransitionEffect =
  | "open"
  | "close"
  | "reopen"
  | "reopen_validation";

export const TRANSITION_EFFECT: Partial<
  Record<`${CycleState}->${CycleState}`, CycleTransitionEffect>
> = {
  "draft->in_response": "open",
  "validated->completed": "close",
  "completed->in_response": "reopen",
  "validated->in_validation": "reopen_validation",
};

export function allowedTransitions(from: CycleState): CycleState[] {
  return transitions[from];
}

export function canTransition(from: CycleState, to: CycleState): boolean {
  return transitions[from].includes(to);
}

/** Só ciclos encerrados podem ser reabertos (recoleta do respondente). */
export function canReopen(from: string | null | undefined): boolean {
  return isCycleCompleted(from);
}

/**
 * Validação concluída (`validated`) pode ser reaberta administrativamente.
 * `completed` exige a reabertura do diagnóstico (recoleta), não esta ação.
 */
export function canReopenValidation(from: string | null | undefined): boolean {
  return from === "validated";
}

/**
 * Efeito colateral de uma aresta (open|close|reopen), ou null para as
 * intermediárias (que só transicionam). Usado pelo endpoint único para
 * despachar internamente ao tratamento correto.
 */
/** Estados em que o respondente pode editar respostas/evidências. */
const RESPONDENT_EDITABLE_FORM_STATES = new Set<CycleState>([
  "in_response",
  "awaiting_adjustment",
]);

/**
 * O respondente pode editar respostas/evidências neste estado de ciclo?
 *
 * Aberto em `in_response` (coleta inicial) e `awaiting_adjustment`
 * (complementação solicitada pelo admin). Fechado durante a validação
 * (`submitted`, `in_validation`), no diagnóstico (`validated`) e no
 * encerramento (`completed`) — assim a análise do admin não é alterada sob
 * seus pés. `draft` é fase de construção do template (sem respondente), mas
 * mantido por completude da máquina.
 */
export function isRespondentEditable(
  cycleState: string | null | undefined,
): boolean {
  if (!cycleState) return false;
  return RESPONDENT_EDITABLE_FORM_STATES.has(cycleState as CycleState);
}

/**
 * Edição do respondente considerando pausa administrativa da coleta.
 * A pausa não altera `cycles.state`; bloqueia apenas a coleta.
 */
export function isRespondentCollectionEditable(
  cycleState: string | null | undefined,
  responseCollectionPausedAt?: string | null,
): boolean {
  if (responseCollectionPausedAt) return false;
  return isRespondentEditable(cycleState);
}

/**
 * Estados pós-fase de resposta do respondente.
 * Usado para determinar que o ciclo saiu da fase de coleta.
 */
const POST_RESPONSE_FORM_STATES: CycleState[] = [
  "submitted",
  "in_validation",
  "awaiting_adjustment",
  "validated",
  "completed",
];

/**
 * Estados em que o Plano de integridade e compliance pode ser criado/editado.
 *
 * A execução e a supervisão acontecem em `validated`. A transição para
 * `completed` só é permitida depois que as ações aplicáveis estão concluídas,
 * sem solicitações abertas e com aceite válido. Após o encerramento, o plano
 * permanece disponível apenas para consulta e auditoria.
 */
export const ACTION_PLAN_ELIGIBLE_STATES: CycleState[] = ["validated"];

/** Ciclo institucional encerrado após a etapa de acompanhamento. */
export function isCycleCompleted(cycleState: string | null | undefined): boolean {
  if (!cycleState) return false;
  return cycleState === "completed";
}

/** Resultado FAMI oficial disponível desde a conclusão da validação. */
export function isOfficialFamiEligible(cycleState: string | null | undefined): boolean {
  return cycleState === "validated" || cycleState === "completed";
}

/** Diagnóstico passou da fase de resposta (sinal global para status da organização). */
export function isCyclePastResponsePhase(cycleState: string | null | undefined): boolean {
  if (!cycleState) return false;
  if (isCycleCompleted(cycleState)) return true;
  return POST_RESPONSE_FORM_STATES.includes(cycleState as CycleState);
}

/**
 * O Plano de integridade e compliance pode ser criado/editado neste estado de ciclo?
 * Disponível somente em `validated`, durante o acompanhamento.
 */
export function isActionPlanEligible(cycleState: string | null | undefined): boolean {
  if (!cycleState) return false;
  return ACTION_PLAN_ELIGIBLE_STATES.includes(cycleState as CycleState);
}
