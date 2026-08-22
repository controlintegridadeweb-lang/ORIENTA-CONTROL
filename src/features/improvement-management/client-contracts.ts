import { z, type ZodType } from "zod";
import { apiResponseSchema } from "@/infrastructure/api/fetch-client";
import { objectContract } from "@/infrastructure/api/contract-schema";
import type {
  ActionPlanAuditEntry,
  ActionPlanListItem,
  ActionPlanProgressUpdate,
  ActionPlanResponsibleMember,
  ActionPlanDeadlineChangeRequest,
  RecommendationActionPlanAuditEntry,
  SupervisionNoteEntry,
} from "./action-plans/types";
import type {
  AdminActionPlanMonitoringResult,
  AdminRecommendationMonitoringResult,
} from "./monitoring/types";
import type { RecommendationFilterOptions } from "./recommendations/filter-options";
import { ACTION_PLAN_COMPLETION_BLOCK_REASONS } from "./action-plans/completion-readiness-model";
import type { ActionPlanCompletionReadiness } from "./action-plans/completion-readiness-model";

const planStatusSchema = z.enum(["not_started", "in_progress", "completed", "cancelled"]);
const recommendationStatusSchema = z.enum([
  "generated",
  "in_action_plan",
  "awaiting_approval",
  "adjustment_requested",
  "exception_requested",
  "completed",
  "dismissed",
]);
export const actionPlanDocumentSchema = z.object({
  id: z.string(),
  actionRevision: z.number().int().positive(),
  kind: z.enum(["file", "link"]),
  title: z.string(),
  externalLink: z.string().nullable(),
  originalFilename: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  fileValidationStatus: z.enum(["not_applicable", "valid", "rejected", "removed"]),
  validatedAt: z.string().nullable(),
  createdAt: z.string(),
  isCurrentRevision: z.boolean(),
});

const actionPlanActionSchema = z.object({
  id: z.string(),
  actionText: z.string(),
  startDate: z.string(),
  dueDate: z.string(),
  responsibleSector: z.string(),
  responsibleUserId: z.string().nullable(),
  responsibleName: z.string(),
  progressPercentage: z.number().int().min(0).max(100),
  status: planStatusSchema,
  observations: z.string().nullable(),
  updatedAt: z.string(),
  revision: z.number().int().positive(),
  documents: z.array(actionPlanDocumentSchema),
  slaLabel: z.enum(["ok", "due_soon", "overdue", "na"]),
});

export const actionPlanListItemSchema: ZodType<ActionPlanListItem> = z.object({
  recommendationId: z.string(),
  questionId: z.string(),
  cycleId: z.string().optional(),
  cycleState: z.string(),
  periodLabel: z.string().optional(),
  formId: z.string(),
  formName: z.string(),
  formVersion: z.number().int(),
  organizationId: z.string(),
  organizationName: z.string(),
  questionPrompt: z.string(),
  sectionId: z.string().default(""),
  sectionName: z.string(),
  sectionOrder: z.number().int().default(0),
  questionOrder: z.number().int().default(0),
  axisId: z.string().optional(),
  axisName: z.string(),
  recommendationType: z.string(),
  recommendationText: z.string(),
  recommendationStatus: recommendationStatusSchema,
  plans: z.array(actionPlanActionSchema),
  slaLabel: z.enum(["ok", "due_soon", "overdue", "na"]),
  recommendationCreatedAt: z.string().optional(),
  recommendationActionCount: z.number().int().nonnegative().optional(),
});

const responsibleMemberSchema: ZodType<ActionPlanResponsibleMember> = z.object({
  userId: z.string(), name: z.string(), email: z.string().nullable(),
});
const actionPlanAuditSchema: ZodType<ActionPlanAuditEntry> = z.object({
  id: z.string(), eventType: z.string(), createdAt: z.string(), actorId: z.string().nullable(), oldValue: z.unknown(), newValue: z.unknown(),
});
const recommendationActionPlanAuditSchema: ZodType<RecommendationActionPlanAuditEntry> = actionPlanAuditSchema.and(z.object({
  actionPlanId: z.string(), actionLabel: z.string(),
}));
const deadlineChangeRequestSchema: ZodType<ActionPlanDeadlineChangeRequest> = z.object({
  id: z.string().uuid(),
  actionPlanId: z.string().uuid(),
  recommendationId: z.string().uuid(),
  organizationId: z.string().uuid(),
  actionRevision: z.number().int().positive(),
  previousDueDate: z.string(),
  requestedDueDate: z.string(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  requestedBy: z.string().uuid(),
  requestedByName: z.string(),
  requestedAt: z.string(),
  decidedBy: z.string().uuid().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionReason: z.string().nullable(),
  appliedActionRevision: z.number().int().positive().nullable(),
});

const supervisionNoteSchema: ZodType<SupervisionNoteEntry> = z.object({
  id: z.string(),
  recommendationId: z.string(),
  actionPlanId: z.string().nullable(),
  actionRevision: z.number().int().nullable(),
  actionSnapshot: z.record(z.string(), z.unknown()),
  actionLabel: z.string().nullable(),
  noteType: z.string(),
  lifecycleStatus: z.string(),
  body: z.string(),
  responseBody: z.string().nullable(),
  respondedBy: z.string().nullable(),
  respondedByName: z.string().nullable(),
  respondedAt: z.string().nullable(),
  resolutionBody: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  resolvedByName: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorRole: z.string(),
});

function paginatedSchema<T>(item: ZodType<T>) {
  return apiResponseSchema({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  });
}

const actionPlanCompletionBlockSchema = z.object({
  recommendationId: z.string(),
  questionId: z.string(),
  questionPrompt: z.string(),
  actionPlanId: z.string().nullable(),
  actionLabel: z.string().nullable(),
  reason: z.enum(ACTION_PLAN_COMPLETION_BLOCK_REASONS),
});

const actionPlanCompletionReadinessSchema: ZodType<ActionPlanCompletionReadiness> = z.object({
  ready: z.boolean(),
  pendingCount: z.number().int().nonnegative(),
  blocks: z.array(actionPlanCompletionBlockSchema),
  countsByReason: z.record(
    z.enum(ACTION_PLAN_COMPLETION_BLOCK_REASONS),
    z.number().int().nonnegative(),
  ),
});

export const actionPlanCompletionReadinessResponseSchema = apiResponseSchema({
  readiness: actionPlanCompletionReadinessSchema,
});

export const actionPlanItemResponseSchema = apiResponseSchema({ item: actionPlanListItemSchema.optional() });
export const actionPlansListResponseSchema = apiResponseSchema({
  items: z.array(actionPlanListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  view: z.enum(["overview", "backlog", "in_progress", "overdue", "completed"]),
});
export const responsibleMembersResponseSchema = apiResponseSchema({ items: z.array(responsibleMemberSchema).optional() });
/** Campos de sucesso opcionais: respostas de erro (`{ error }`) também precisam parsear. */
export const savePlanResponseSchema = apiResponseSchema({
  planId: z.string().optional(),
  mode: z.enum(["created", "updated"]).optional(),
  revision: z.number().int().positive().optional(),
});
export const deletePlanResponseSchema = apiResponseSchema({
  planId: z.string().optional(),
  mode: z.literal("deleted").optional(),
  revision: z.number().int().positive().optional(),
});
export const actionPlanAuditPageSchema = paginatedSchema(actionPlanAuditSchema);
const actionPlanProgressUpdateSchema: ZodType<ActionPlanProgressUpdate> = z.object({
  id: z.string(),
  previousPercentage: z.number().int().min(0).max(100),
  newPercentage: z.number().int().min(0).max(100),
  previousStatus: planStatusSchema,
  newStatus: planStatusSchema,
  description: z.string().nullable(),
  createdAt: z.string(),
  createdByName: z.string(),
});
export const actionPlanProgressUpdatesResponseSchema = apiResponseSchema({
  items: z.array(actionPlanProgressUpdateSchema),
});
export const recommendationAuditPageSchema = paginatedSchema(recommendationActionPlanAuditSchema);
export const deadlineChangeRequestsPageSchema = paginatedSchema(deadlineChangeRequestSchema);
export const deadlineChangeRequestResponseSchema = apiResponseSchema({ deadlineChange: deadlineChangeRequestSchema });
export const supervisionNotesPageSchema = paginatedSchema(supervisionNoteSchema);
export const supervisionNoteResponseSchema = apiResponseSchema({ note: supervisionNoteSchema });
export const actionPlanDocumentResponseSchema = apiResponseSchema({
  document: actionPlanDocumentSchema,
});
export const actionPlanDocumentUploadInitializationSchema = apiResponseSchema({
  pendingUploadId: z.string().uuid(),
  storagePath: z.string().min(1),
  bucket: z.literal("planos-acao"),
  expiresAt: z.string(),
  uploadToken: z.string().min(1),
});
export const actionPlanDocumentUploadDiscardResponseSchema = apiResponseSchema({
  ok: z.boolean(),
  cleanupPending: z.boolean().optional(),
});
export const actionPlanDocumentDeleteResponseSchema = apiResponseSchema({ ok: z.boolean() });

const adminPlanItemContract = objectContract<AdminActionPlanMonitoringResult["items"][number]>("item de monitoramento do plano", {
  rowKey: "string", recommendationId: "string", questionId: "string", organizationId: "string", organizationName: "string", formId: "string", cycleId: "string", periodLabel: "string", formName: "string", formVersion: "number", axisId: "string", axisName: "string", sectionId: "string", sectionName: "string", sectionOrder: "number", questionOrder: "number", questionPrompt: "string", recommendationText: "string", recommendationType: "string", recommendationStatus: "string", view: "string", riskScore: "number", risk: "string", hasPlan: "boolean", isOverdue: "boolean", isDueSoon: "boolean", actionText: "string", responsibleName: "string", responsibleSector: "string", startDate: "nullable-string", lastActivityLabel: "string", progress: "number", totalActionsForRecommendation: "number", slaLabel: "string",
});
const adminPlanSummaryContract = objectContract<AdminActionPlanMonitoringResult["summary"]>("resumo do monitoramento de planos", {
  total: "number", inProgress: "number", completed: "number", overdue: "number", withoutResponsible: "number", dueSoon: "number", highRisk: "number", lowProgress: "number",
});
const adminRecommendationItemContract = objectContract<AdminRecommendationMonitoringResult["items"][number]>("item de monitoramento da recomendação", {
  recommendationId: "string", questionId: "string", plans: "array", organizationId: "string", organizationName: "string", formId: "string", cycleId: "string", cycleState: "string", canCreateActionPlan: "boolean", periodLabel: "string", formName: "string", formVersion: "number", axisId: "string", axisName: "string", sectionName: "string", questionPrompt: "string", recommendationText: "string", recommendationType: "string", recommendationStatus: "string", hasPlan: "boolean", isOverdue: "boolean", isDueSoon: "boolean", progress: "number",
});
const adminRecommendationSummaryContract = objectContract<AdminRecommendationMonitoringResult["summary"]>("resumo do monitoramento de recomendações", {
  total: "number", withoutPlan: "number", withPlan: "number", inExecution: "number", completed: "number", overdue: "number",
});
function monitoringResponseSchema<TItem extends object, TSummary extends object>(item: ZodType<TItem>, summary: ZodType<TSummary>) {
  return apiResponseSchema({
    items: z.array(item), summary,
    total: z.number().int().nonnegative(), paginationTotal: z.number().int().nonnegative(),
    page: z.number().int().positive(), pageSize: z.number().int().positive(), totalPages: z.number().int().nonnegative(),
    layout: z.enum(["list", "organization"]), selectedCycleLabel: z.string().nullable(),
  });
}
export const adminActionPlanMonitoringSchema = monitoringResponseSchema(adminPlanItemContract, adminPlanSummaryContract);
export const adminRecommendationMonitoringSchema = monitoringResponseSchema(adminRecommendationItemContract, adminRecommendationSummaryContract);

export const recommendationFilterResponseSchema: ZodType<RecommendationFilterOptions> =
  apiResponseSchema({
    forms: z.array(z.object({ id: z.string(), name: z.string(), version: z.number().int() })),
    organizations: z.array(z.object({ id: z.string(), name: z.string() })),
    axes: z.array(z.object({ id: z.string(), name: z.string() })),
    types: z.array(z.string()),
    statuses: z.array(recommendationStatusSchema),
  }) as ZodType<RecommendationFilterOptions>;
