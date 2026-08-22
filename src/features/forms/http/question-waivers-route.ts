import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/infrastructure/api/auth";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { QuestionWaiverService } from "@/features/forms/question-waiver-service";
import { logError } from "@/infrastructure/observability/logger";

const uuidSchema = z.string().uuid();

const replacementSchema = z
  .object({
    questionId: uuidSchema,
    scopeOrganizationIds: z.array(uuidSchema).min(1).max(5000),
    waivers: z
      .array(
        z.object({
          organizationId: uuidSchema,
          reason: z.string().trim().max(1000).nullable(),
        }),
      )
      .max(5000),
  })
  .superRefine((value, context) => {
    const scope = new Set(value.scopeOrganizationIds);
    if (scope.size !== value.scopeOrganizationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["scopeOrganizationIds"],
        message: "A lista de organizações contém identificadores repetidos.",
      });
    }

    const waiverOrganizations = new Set<string>();
    for (const [index, waiver] of value.waivers.entries()) {
      if (!scope.has(waiver.organizationId)) {
        context.addIssue({
          code: "custom",
          path: ["waivers", index, "organizationId"],
          message: "A organização não pertence ao escopo informado.",
        });
      }
      if (waiverOrganizations.has(waiver.organizationId)) {
        context.addIssue({
          code: "custom",
          path: ["waivers", index, "organizationId"],
          message: "A organização foi informada mais de uma vez.",
        });
      }
      waiverOrganizations.add(waiver.organizationId);
    }
  });

const listSchema = z.object({
  organizationIds: z.array(uuidSchema).min(1).max(5000),
});

export async function POST(request: Request) {
  const { context: authContext, error: authError } = await requireAuth(
    request,
    ["admin"],
  );
  if (authError) return authError;

  try {
    const parsed = listSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const organizationIds = [...new Set(parsed.data.organizationIds)];
    for (const organizationId of organizationIds) {
      const tenantError = ensureOrganizationAccess(
        authContext,
        organizationId,
      );
      if (tenantError) return tenantError;
    }

    const service = new QuestionWaiverService();
    const waivers = await service.listWaiversForOrganizations(organizationIds);
    return NextResponse.json({ waivers });
  } catch (error: unknown) {
    logError("Failed to list question waivers in batch", error, {
      route: "/api/admin/question-waivers",
    });
    return NextResponse.json(
      { error: "Falha ao carregar a aplicabilidade das organizações." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { context: authContext, error: authError } = await requireAuth(
    request,
    ["admin"],
  );
  if (authError) return authError;

  try {
    const parsed = replacementSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    for (const organizationId of parsed.data.scopeOrganizationIds) {
      const tenantError = ensureOrganizationAccess(
        authContext,
        organizationId,
      );
      if (tenantError) return tenantError;
    }

    const service = new QuestionWaiverService();
    await service.replaceWaiversForQuestion({
      questionId: parsed.data.questionId,
      scopeOrganizationIds: parsed.data.scopeOrganizationIds,
      waivers: parsed.data.waivers,
      waivedBy: authContext.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    logError("Failed to replace question waivers", error, {
      route: "/api/admin/question-waivers",
    });
    return NextResponse.json(
      {
        error:
          "Falha ao atualizar a aplicabilidade. Nenhuma alteração foi aplicada.",
      },
      { status: 500 },
    );
  }
}
