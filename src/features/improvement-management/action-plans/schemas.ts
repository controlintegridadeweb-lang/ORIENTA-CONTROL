import { z } from "zod";
import { recommendationStatusSchema } from "@/shared/domain/recommendation-status";
import { isLocalDate } from "@/shared/datetime/business-date";

/** Estados persistidos do plano de ação. Atraso é SLA calculado pelo prazo. */
const planStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
]);

export type PlanStatus = z.infer<typeof planStatusSchema>;

const actionPlanListViewSchema = z.enum([
  "overview",
  "backlog",
  "in_progress",
  "overdue",
  "completed",
]);

export type ActionPlanListView = z.infer<typeof actionPlanListViewSchema>;

export const listActionPlansQuerySchema = z.object({
  cycleId: z.string().uuid().optional(),
  formId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  recommendationId: z.string().uuid().optional(),
  view: actionPlanListViewSchema.default("overview"),
  recommendationStatus: recommendationStatusSchema.optional(),
  planStatus: planStatusSchema.optional(),
  responsibleContains: z.string().trim().min(1).max(200).optional(),
  search: z.string().trim().min(1).max(500).optional(),
  dueFilter: z.enum(["all", "overdue", "due_7d"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const localDateSchema = z
  .string()
  .trim()
  .refine(isLocalDate, "Informe uma data válida no formato AAAA-MM-DD.");

const progressPercentageSchema = z
  .number({ error: "Informe o progresso como número inteiro entre 0 e 100." })
  .int("O progresso deve ser um número inteiro.")
  .min(0, "O progresso mínimo é 0%.")
  .max(100, "O progresso máximo é 100%.");

function refineActionDates(
  value: { startDate: string; dueDate: string },
  ctx: z.RefinementCtx,
) {
  if (value.dueDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dueDate"],
      message: "O final não pode ser anterior ao início.",
    });
  }
}

/** Cadastro inicial — progresso nasce 0% no domínio; sem cancelamento. */
export const createActionPlanSchema = z
  .object({
    intent: z.literal("create"),
    recommendationId: z.string().uuid(),
    actionText: z.string().trim().min(5).max(4000),
    startDate: localDateSchema,
    dueDate: localDateSchema,
    responsibleSector: z.string().trim().min(2).max(200),
    responsibleUserId: z.string().uuid(),
  })
  .strict()
  .superRefine(refineActionDates);

/** Atualização operacional de andamento (não altera dados cadastrais). */
export const updateActionProgressSchema = z
  .object({
    intent: z.literal("update_progress"),
    planId: z.string().uuid(),
    recommendationId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    progressPercentage: progressPercentageSchema,
    progressUpdateDescription: z
      .string()
      .trim()
      .min(5, "Descreva o que foi realizado nesta atualização.")
      .max(4000),
  })
  .strict();

/** Edição cadastral. O final é compromisso administrativo e não é editável diretamente. */
export const editActionDetailsSchema = z
  .object({
    intent: z.literal("edit_details"),
    planId: z.string().uuid(),
    recommendationId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    actionText: z.string().trim().min(5).max(4000),
    startDate: localDateSchema,
    responsibleSector: z.string().trim().min(2).max(200),
    responsibleUserId: z.string().uuid(),
  })
  .strict();

/** Cancelamento excepcional — preserva histórico; exige motivo. */
export const cancelActionCommandSchema = z
  .object({
    intent: z.literal("cancel"),
    planId: z.string().uuid(),
    recommendationId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    observations: z
      .string()
      .trim()
      .min(1, "Informe o motivo do cancelamento.")
      .max(4000),
  })
  .strict();

export const respondentActionCommandSchema = z.discriminatedUnion("intent", [
  createActionPlanSchema,
  updateActionProgressSchema,
  editActionDetailsSchema,
  cancelActionCommandSchema,
]);

export type RespondentActionCommand = z.infer<typeof respondentActionCommandSchema>;

export { progressPercentageSchema };


export const deadlineChangeStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type DeadlineChangeStatus = z.infer<typeof deadlineChangeStatusSchema>;

export const requestActionPlanDeadlineChangeSchema = z
  .object({
    planId: z.string().uuid(),
    recommendationId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    requestedDueDate: localDateSchema,
    reason: z
      .string()
      .trim()
      .min(10, "Explique o motivo da alteração do final com pelo menos 10 caracteres.")
      .max(4000),
  })
  .strict();

export const decideActionPlanDeadlineChangeSchema = z
  .object({
    requestId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    decisionReason: z
      .string()
      .trim()
      .min(5, "Informe a justificativa da decisão.")
      .max(4000),
  })
  .strict();

export const listActionPlanDeadlineChangesQuerySchema = z
  .object({
    recommendationId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    status: deadlineChangeStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const deleteActionPlanSchema = z
  .object({
    planId: z.string().uuid(),
    recommendationId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

/** Tipos persistidos e exibidos no histórico de supervisão. */
export const supervisionNoteTypeSchema = z.enum([
  "comment",
  "adjustment_request",
  "opinion",
  "approval",
  "pending",
  "forwarding",
]);
export type SupervisionNoteType = z.infer<typeof supervisionNoteTypeSchema>;
export type SupervisionNoteComposerType = SupervisionNoteType;

export const supervisionLifecycleStatusSchema = z.enum([
  "recorded",
  "open",
  "acknowledged",
  "resolved",
  "cancelled",
  "effective",
  "superseded",
]);
export type SupervisionLifecycleStatus = z.infer<
  typeof supervisionLifecycleStatusSchema
>;

const actionScopedNoteTypes = new Set<SupervisionNoteType>([
  "adjustment_request",
  "approval",
  "pending",
]);

export const historyPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listSupervisionNotesQuerySchema = z.object({
  recommendationId: z.string().uuid(),
  actionPlanId: z.string().uuid().optional(),
  lifecycleStatuses: z.array(supervisionLifecycleStatusSchema).max(7).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createSupervisionNoteSchema = z.object({
  recommendationId: z.string().uuid(),
  actionPlanId: z.string().uuid().optional(),
  noteType: supervisionNoteTypeSchema,
  body: z.string().trim().min(1).max(4000),
}).strict().superRefine((value, ctx) => {
  if (actionScopedNoteTypes.has(value.noteType) && !value.actionPlanId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actionPlanId"],
      message: "Selecione a ação à qual este registro se refere.",
    });
  }
});

export const respondSupervisionRequestSchema = z.object({
  noteId: z.string().uuid(),
  responseBody: z.string().trim().min(1).max(4000),
}).strict();

export const decideSupervisionRequestSchema = z.object({
  noteId: z.string().uuid(),
  decision: z.enum(["resolved", "cancelled"]),
  resolutionBody: z.string().trim().min(1).max(4000),
}).strict();
