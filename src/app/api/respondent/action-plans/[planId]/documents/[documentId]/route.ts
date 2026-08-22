import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { ActionPlanDocumentService } from "@/features/improvement-management/action-plans/document-service";
import { actionPlanDocumentDeactivateBodySchema } from "@/features/improvement-management/action-plans/document-http-contracts";

export const DELETE = withRoute<{ planId: string; documentId: string }>(
  {
    roles: ["respondent"],
    route: "/api/respondent/action-plans/[planId]/documents/[documentId]",
    logMessage: "Failed to deactivate action plan document",
  },
  async ({ auth, params, request }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const parsed = actionPlanDocumentDeactivateBodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados da remoção inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await new ActionPlanDocumentService().deactivate(
      {
        planId: requireUuid(params.planId, "planId"),
        documentId: requireUuid(params.documentId, "documentId"),
        expectedRevision: parsed.data.expectedRevision,
        reason: parsed.data.reason,
      },
      {
        userId: auth.userId,
        organizationId: auth.organizationId,
      },
    );
    return NextResponse.json({ ok: true });
  },
);
