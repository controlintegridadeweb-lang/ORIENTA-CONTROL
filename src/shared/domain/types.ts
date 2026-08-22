import type { AdminProofStatusValue } from "./admin-proof-status";

/** Status de validação de evidência embutido em evidences. */
export type ValidationStatus =
  | "pending"
  | "approved"
  /** Estados de apresentação adicionais dos leitores de evidência. */
  | "not_required"
  | "submitted"
  | "invalidated"
  | "adjustment_requested";

export type AnswerValue = "yes" | "no" | "not_applicable";

/**
 * Máquina de estados do ciclo institucional.
 * Fonte de verdade: `cycles.state` (não `forms.state`).
 */
export type CycleState =
  | "draft"
  | "in_response"
  | "submitted"
  | "in_validation"
  | "awaiting_adjustment"
  | "validated"
  | "completed";

/** 7 arestas de avanço — paridade com `cycle_can_transition` (SQL). */
export const CANONICAL_TRANSITIONS: ReadonlyArray<
  readonly [CycleState, CycleState]
> = [
  ["draft", "in_response"],
  ["in_response", "submitted"],
  ["submitted", "in_validation"],
  ["in_validation", "awaiting_adjustment"],
  ["awaiting_adjustment", "in_validation"],
  ["in_validation", "validated"],
  ["validated", "completed"],
] as const;

/** Reabertura excepcional — fora do mapa `canTransition`, via `reopen_cycle`. */
export const REOPEN_TRANSITION: readonly [CycleState, CycleState] = [
  "completed",
  "in_response",
];

/**
 * Reabertura administrativa da validação — fora do mapa `canTransition`,
 * via `reopen_validation_cycle`. Não reabre o preenchimento do respondente.
 */
export const VALIDATION_REOPEN_TRANSITION: readonly [CycleState, CycleState] = [
  "validated",
  "in_validation",
];

/** Tipo operacional = tipo da biblioteca (sem tradução). */
export type RecommendationType =
  | "nao_implementacao"
  | "ausencia_evidencia"
  | "evidencia_insuficiente";

/** Gatilho exato materializado no campo `origin.trigger`. */
export type RecommendationTrigger =
  | "resposta_nao"
  | "evidencia_ausente"
  | "evidencia_invalida";

/**
 * Situação canônica da recomendação, derivada em leitura e nunca gravada.
 * A situação considera dispensa, exceção, ações, ajustes e aceites da revisão atual.
 */
export type DerivedRecommendationStatus =
  | "generated"
  | "in_action_plan"
  | "awaiting_approval"
  | "adjustment_requested"
  | "exception_requested"
  | "completed"
  | "dismissed";

/** Status de ação canônico (seção 6.7) */
export type ActionPlanStatus = "todo" | "doing" | "done" | "cancelled";

export type AdminProofStatus = AdminProofStatusValue;

export type QuestionInput = {
  id: string;
  questionVersionId?: string;
  axisId: string;
  sectionId: string;
  famiEnabled: boolean;
  requiresEvidence: boolean;
  appliesToRespondent?: boolean;
  answer: AnswerValue;
  validationStatus?: ValidationStatus;
  /** Decisão administrativa de comprovação (Sim sem documento). */
  adminProofStatus?: AdminProofStatus | null;
  isNotApplicable?: boolean;
  waived?: boolean;
  hasEvidence?: boolean;
};

/** Nível FAMI: 1–5 ou N/A quando denominador zero */
export type FamiLevel = 1 | 2 | 3 | 4 | 5 | "N/A";
