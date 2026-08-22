import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { ActionPlanDocumentService } from "@/features/improvement-management/action-plans/document-service";
import {
  actionPlanDocumentConfirmBodySchema,
  actionPlanDocumentCreateBodySchema,
  actionPlanDocumentDiscardBodySchema,
} from "@/features/improvement-management/action-plans/document-http-contracts";

const ROUTE = "/api/respondent/action-plans/[planId]/documents";

function respondentCaller(auth: { userId: string; organizationId: string }) {
  return { userId: auth.userId, organizationId: auth.organizationId };
}

function badRequest(error: string, issues: unknown) {
  return NextResponse.json({ error, issues }, { status: 400 });
}

export const POST = withRoute<{ planId: string }>(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to add action plan document",
  },
  async ({ auth, params, request }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const parsed = actionPlanDocumentCreateBodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return badRequest("Dados da comprovação inválidos.", parsed.error.flatten());
    }

    const planId = requireUuid(params.planId, "planId");
    const caller = respondentCaller({
      userId: auth.userId,
      organizationId: auth.organizationId,
    });
    const service = new ActionPlanDocumentService();

    if (parsed.data.kind === "link") {
      const document = await service.addLink(
        {
          planId,
          expectedRevision: parsed.data.expectedRevision,
          title: parsed.data.title,
          externalLink: parsed.data.externalLink,
        },
        caller,
      );
      return NextResponse.json({ document });
    }

    const initialization = await service.initializeFile(
      {
        planId,
        expectedRevision: parsed.data.expectedRevision,
        title: parsed.data.title,
        filename: parsed.data.filename,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      },
      caller,
    );
    return NextResponse.json(initialization);
  },
);

export const PATCH = withRoute<{ planId: string }>(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to confirm action plan document upload",
  },
  async ({ auth, params, request }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const parsed = actionPlanDocumentConfirmBodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return badRequest("Confirmação de upload inválida.", parsed.error.flatten());
    }

    const document = await new ActionPlanDocumentService().confirmFile(
      {
        planId: requireUuid(params.planId, "planId"),
        pendingUploadId: parsed.data.pendingUploadId,
        expectedRevision: parsed.data.expectedRevision,
      },
      respondentCaller({
        userId: auth.userId,
        organizationId: auth.organizationId,
      }),
    );
    return NextResponse.json({ document });
  },
);

export const DELETE = withRoute<{ planId: string }>(
  {
    roles: ["respondent"],
    route: ROUTE,
    logMessage: "Failed to discard pending action plan document",
  },
  async ({ auth, params, request }) => {
    if (!auth.organizationId) {
      return NextResponse.json(
        { error: "Usuário sem organização vinculada." },
        { status: 403 },
      );
    }

    const parsed = actionPlanDocumentDiscardBodySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return badRequest("Identificador do upload inválido.", parsed.error.flatten());
    }

    const result = await new ActionPlanDocumentService().discardPendingFile(
      {
        planId: requireUuid(params.planId, "planId"),
        pendingUploadId: parsed.data.pendingUploadId,
      },
      respondentCaller({
        userId: auth.userId,
        organizationId: auth.organizationId,
      }),
    );
    return NextResponse.json(result);
  },
);
