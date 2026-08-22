import { z } from "zod";
import { isLocalDate } from "@/shared/datetime/business-date";
import { recommendationStatusSchema } from "@/shared/domain/recommendation-status";

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalLocalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().refine(isLocalDate, "Informe uma data válida no formato AAAA-MM-DD.").optional(),
);

const baseSchema = z
  .object({
    organizationId: optionalUuid,
    formId: optionalUuid,
    cycleId: optionalUuid,
    search: optionalTrimmedString(500),
    from: optionalLocalDate,
    to: optionalLocalDate,
    layout: z.enum(["list", "organization"]).default("list"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    export: z.preprocess(
      (value) => (value === "true" ? true : value === "false" ? false : value),
      z.boolean().default(false),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "A data final não pode ser anterior à data inicial.",
      });
    }
  });

export const adminActionPlanMonitoringQuerySchema = baseSchema.and(
  z.object({
    view: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["not_started", "in_progress", "overdue", "completed", "cancelled"]).optional(),
      ),
    cardFilter: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["in_progress", "completed", "overdue"]).optional(),
      ),
  }),
);

export const adminRecommendationMonitoringQuerySchema = baseSchema.and(
  z.object({
    axisId: optionalUuid,
    status: z.preprocess(
      (value) => (value === "" ? undefined : value),
      recommendationStatusSchema.optional(),
    ),
    cardFilter: z
      .preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["without_plan", "executing", "completed", "overdue"]).optional(),
      ),
  }),
);

export type ParsedAdminActionPlanMonitoringQuery = z.infer<
  typeof adminActionPlanMonitoringQuerySchema
>;
export type ParsedAdminRecommendationMonitoringQuery = z.infer<
  typeof adminRecommendationMonitoringQuerySchema
>;
