import type { ActionPlanAction, ActionPlanByCyclePayload } from "@/features/improvement-management/action-plans/domain-model";
import type { RecommendationWithPlansRow } from "@/features/improvement-management/action-plans/domain-model";
import type { RecommendationStatus } from "@/shared/domain/recommendation-status";
import type { ActionPlanListView, PlanStatus } from "./schemas";

export type { ActionPlanByCyclePayload };

export type ActionPlanListItem = {
  recommendationId: string;
  questionId: string;
  cycleId?: string;
  /** Estado atual do diagnóstico que originou a recomendação. */
  cycleState: string;
  periodLabel?: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  questionPrompt: string;
  sectionId: string;
  sectionName: string;
  /** Ordem oficial da seção no formulário (`question_versions.section_order`). */
  sectionOrder: number;
  /** Ordem do critério no formulário (`form_questions.order_index`). */
  questionOrder: number;
  axisId?: string;
  axisName: string;
  recommendationType: string;
  recommendationText: string;
  recommendationStatus: RecommendationStatus;
  plans: ActionPlanAction[];
  slaLabel: "ok" | "due_soon" | "overdue" | "na";
  /** Data de criação da recomendação no banco (quando disponível na listagem). */
  recommendationCreatedAt?: string;
  /** Total de ações vinculadas à recomendação, usado no badge “ação 1/N”. */
  recommendationActionCount?: number;
};

export type ActionPlanResponsibleMember = {
  userId: string;
  name: string;
  email: string | null;
};

export type ActionPlansListResult = {
  items: ActionPlanListItem[];
  total: number;
  limit: number;
  offset: number;
  view: ActionPlanListView;
};



export type ActionPlanDeadlineChangeRequest = {
  id: string;
  actionPlanId: string;
  recommendationId: string;
  organizationId: string;
  actionRevision: number;
  previousDueDate: string;
  requestedDueDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  appliedActionRevision: number | null;
};

export type PaginatedHistory<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type ActionPlanAuditEntry = {
  id: string;
  eventType: string;
  createdAt: string;
  actorId: string | null;
  oldValue: unknown;
  newValue: unknown;
};

/** Movimentação persistida em `action_plan_progress_updates`. */
export type ActionPlanProgressUpdate = {
  id: string;
  previousPercentage: number;
  newPercentage: number;
  previousStatus: PlanStatus;
  newStatus: PlanStatus;
  description: string | null;
  createdAt: string;
  createdByName: string;
};

export type RecommendationActionPlanAuditEntry = ActionPlanAuditEntry & {
  actionPlanId: string;
  actionLabel: string;
};

export type SupervisionNoteEntry = {
  id: string;
  recommendationId: string;
  actionPlanId: string | null;
  actionRevision: number | null;
  actionSnapshot: Record<string, unknown>;
  actionLabel: string | null;
  noteType: string;
  lifecycleStatus: string;
  body: string;
  responseBody: string | null;
  respondedBy: string | null;
  respondedByName: string | null;
  respondedAt: string | null;
  resolutionBody: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorRole: string;
};

export type RecommendationRowRaw = RecommendationWithPlansRow & {
  cycle_id: string;
  period_label: string;
  cycle_state: string;
  axis_id: string;
  section_order?: number | null;
  question_order?: number | null;
  organizations: unknown;
  forms: unknown;
  created_at?: string;
};

export type FormRow = { id: string; name: string; version: number };
export type OrgRow = { id: string; name: string };
export type QuestionJoin = {
  id: string;
  prompt: string;
  section_id: string | null;
  section_order?: number | null;
  question_order?: number | null;
  sections:
    | { name: string; axes: { name: string; id: string } | { name: string; id: string }[] | null }
    | { name: string; axes: { name: string; id: string } | { name: string; id: string }[] | null }[]
    | null;
};
