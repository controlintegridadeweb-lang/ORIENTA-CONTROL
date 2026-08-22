import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { processCyclesForOrganizations } from "@/features/cycles/create-cycle-service";
import { handleDomainError } from "@/infrastructure/api/domain-errors";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";

const batchBodySchema = z
  .object({
    formId: z.string().uuid(),
    organizationIds: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos uma organização.")
      .max(1000),
    periodLabel: z.string().trim().min(1, "Informe o período do diagnóstico.").max(60),
    referenceStartYear: z.number().int().min(1900).max(2199),
    referenceEndYear: z.number().int().min(1900).max(2199),
    startsAt: z.string().datetime().optional().nullable(),
    responseDeadlineAt: z.string().datetime().optional().nullable(),
    mode: z.enum(["draft", "open", "schedule"]).default("draft"),
    reminderOffsetsDays: z.array(z.number().int().min(0).max(90)).max(10).default([]),
    validationDeadlineAt: z.string().datetime().optional().nullable(),
    cycleCloseAt: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.referenceEndYear < data.referenceStartYear) {
      context.addIssue({
        code: "custom",
        path: ["referenceEndYear"],
        message: "O ano final não pode ser anterior ao ano inicial.",
      });
    }
    const start = data.startsAt ? new Date(data.startsAt) : null;
    const deadline = data.responseDeadlineAt ? new Date(data.responseDeadlineAt) : null;
    const validationDeadline = data.validationDeadlineAt
      ? new Date(data.validationDeadlineAt)
      : null;
    const closeAt = data.cycleCloseAt ? new Date(data.cycleCloseAt) : null;

    if (data.mode !== "draft") {
      if (!start) {
        context.addIssue({
          code: "custom",
          path: ["startsAt"],
          message: "Informe a data de abertura dos diagnósticos.",
        });
      }
      if (!deadline) {
        context.addIssue({
          code: "custom",
          path: ["responseDeadlineAt"],
          message: "Informe o prazo de resposta.",
        });
      }
    }

    if (start && deadline && deadline < start) {
      context.addIssue({
        code: "custom",
        path: ["responseDeadlineAt"],
        message: "O prazo de resposta não pode ser anterior à abertura.",
      });
    }

    const now = Date.now();
    if (data.mode === "open" && start && start.getTime() > now + 5 * 60_000) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Para abrir agora, a data de início não pode estar no futuro.",
      });
    }
    if (data.mode === "schedule" && start && start.getTime() <= now + 5 * 60_000) {
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Para agendar, informe uma abertura futura.",
      });
    }
    if (data.mode !== "draft" && deadline && deadline.getTime() <= now) {
      context.addIssue({
        code: "custom",
        path: ["responseDeadlineAt"],
        message: "O prazo de resposta deve estar no futuro.",
      });
    }

    if (validationDeadline && deadline && validationDeadline <= deadline) {
      context.addIssue({
        code: "custom",
        path: ["validationDeadlineAt"],
        message: "A conclusão programada da validação deve ocorrer após o prazo de resposta.",
      });
    }
    if (closeAt && !validationDeadline) {
      context.addIssue({
        code: "custom",
        path: ["cycleCloseAt"],
        message: "Informe a conclusão programada da validação antes do encerramento.",
      });
    } else if (closeAt && validationDeadline && closeAt <= validationDeadline) {
      context.addIssue({
        code: "custom",
        path: ["cycleCloseAt"],
        message: "O encerramento programado deve ocorrer após a validação.",
      });
    }
    if (data.mode === "draft" && (start || deadline)) {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Rascunhos não podem receber datas de abertura ou prazo.",
      });
    }
    if (
      data.mode === "draft" &&
      (data.reminderOffsetsDays.length > 0 || validationDeadline || closeAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["mode"],
        message: "Abra ou agende os diagnósticos antes de configurar ações programadas.",
      });
    }
  });

/**
 * Ponto único para criar diagnósticos em uma ou várias organizações. A seleção
 * vem exclusivamente de form_assignments; ações futuras são jobs internos
 * vinculados aos ciclos criados, sem entidade ou estado operacional paralelo.
 */
export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/batch",
    logMessage: "Failed to process cycles in batch",
  },
  async ({ request, auth }) => {
    const parsed = batchBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const organizationIds = Array.from(new Set(parsed.data.organizationIds));
    for (const organizationId of organizationIds) {
      const tenantError = ensureOrganizationAccess(auth, organizationId);
      if (tenantError) return tenantError;
    }

    const supabase = createSupabaseServiceRoleClient();
    try {
      const commonInput = {
        formId: parsed.data.formId,
        organizationIds,
        periodLabel: parsed.data.periodLabel,
        referenceStartYear: parsed.data.referenceStartYear,
        referenceEndYear: parsed.data.referenceEndYear,
        actorUserId: auth.userId,
      };

      const result = await processCyclesForOrganizations(supabase, {
        ...commonInput,
        mode: parsed.data.mode,
        startsAt: parsed.data.startsAt ?? null,
        responseDeadlineAt: parsed.data.responseDeadlineAt ?? null,
        reminderOffsetsDays: parsed.data.reminderOffsetsDays,
        validationDeadlineAt: parsed.data.validationDeadlineAt,
        cycleCloseAt: parsed.data.cycleCloseAt,
      });

      return NextResponse.json(
        { ...result, mode: parsed.data.mode },
        { status: 200 },
      );
    } catch (error) {
      return handleDomainError(error);
    }
  },
);
