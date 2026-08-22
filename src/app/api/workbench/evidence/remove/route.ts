import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { discardPendingEvidenceUpload } from "@/features/evidences/pending-evidence-uploads";
import { resolveAuthorizedWorkbenchContext } from "@/features/workbench/authorized-context";
import { removeWorkbenchEvidence } from "@/features/workbench/remove-workbench-evidence";

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  evidenceId: z.string().uuid().optional(),
  pendingUploadId: z.string().uuid().optional(),
  expectedRevision: z.number().int().positive().nullable().optional(),
}).superRefine((value, context) => {
  if (!value.questionId && !value.pendingUploadId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe a pergunta ou o upload temporário.",
    });
  }
  if (value.questionId && value.expectedRevision == null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedRevision"],
      message: "A revisão atual da resposta é obrigatória.",
    });
  }
});

/** Remove evidência persistida ou descarta um upload temporário do respondente. */
export const POST = withRoute(
  {
    roles: ["respondent"],
    route: "/api/workbench/evidence/remove",
    logMessage: "Failed to remove workbench evidence",
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const access = await resolveAuthorizedWorkbenchContext(auth, parsed.data.cycleId);
    if (access.context === null) return access.error;
    const { scope, supabase } = access.context;

    if (parsed.data.pendingUploadId) {
      const discarded = await discardPendingEvidenceUpload(supabase, {
        pendingUploadId: parsed.data.pendingUploadId,
        cycleId: scope.cycle.id,
        organizationId: scope.cycle.organizationId,
        uploadedBy: auth.userId,
      });
      if (!discarded.ok) {
        return NextResponse.json({ error: discarded.error }, { status: discarded.status });
      }
      return NextResponse.json({
        ok: true,
        discardedPendingUpload: true,
        evidenceCleanupPending: discarded.cleanupPending,
      });
    }

    const result = await removeWorkbenchEvidence(supabase, {
      cycleId: scope.cycle.id,
      organizationId: scope.cycle.organizationId,
      actorUserId: auth.userId,
      questionId: parsed.data.questionId!,
      evidenceId: parsed.data.evidenceId,
      expectedRevision: parsed.data.expectedRevision!,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      discardedPendingUpload: false,
      evidenceCleanupPending: result.cleanupPending,
    });
  },
);
