import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { adminProofStatusSchema } from "@/shared/domain/admin-proof-status";
import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import { CycleStateService } from "@/features/cycles/server";
import {
  isCycleCompleted,
  isRespondentCollectionEditable,
} from "@/shared/domain/workflow";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { isEvidenceStoragePathForCycle } from "@/features/evidences";
import { purgeRetiredUnsnapshottedEvidence } from "@/features/workbench/evidence-lifecycle";
import { isHttpUrl } from "@/shared/validation/http-url";
import {
  formatYesEvidenceErrors,
  validateYesWithEvidence,
  type YesEvidenceFieldErrors,
} from "@/features/workbench/validate-yes-evidence";
import { validateNaJustification } from "@/shared/domain/not-applicable";
import { MAX_EVIDENCES_PER_SAVE } from "@/features/workbench/evidence-limits";

const EVIDENCE_LINK_REASON_FALLBACK = "Evidência fornecida por link externo.";

const evidenceSchema = z
  .object({
    kind: z.enum(["file", "link", "text"]),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(4000).optional().default(""),
    storagePath: z.string().min(1).max(2000).optional(),
    pendingUploadId: z.string().uuid().optional(),
    externalLink: z
      .string()
      .url()
      .max(2000)
      .refine(isHttpUrl, "Use um link iniciado por http:// ou https://.")
      .optional(),
    textBody: z.string().max(20000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "file" && !value.storagePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storagePath é obrigatório para evidência por arquivo.",
        path: ["storagePath"],
      });
    }
    if (value.kind === "file" && !value.pendingUploadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pendingUploadId é obrigatório para evidência por arquivo.",
        path: ["pendingUploadId"],
      });
    }
    if (value.kind === "link" && value.pendingUploadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pendingUploadId não pode ser usado em evidência por link.",
        path: ["pendingUploadId"],
      });
    }
    if (value.kind === "link" && !value.externalLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "externalLink é obrigatório para evidência por link.",
        path: ["externalLink"],
      });
    }
    if (value.kind === "text") {
      if (value.pendingUploadId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pendingUploadId não pode ser usado em evidência textual.",
          path: ["pendingUploadId"],
        });
      }
      if (value.storagePath || value.externalLink) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Evidência textual não pode ter arquivo ou link.",
          path: ["textBody"],
        });
      }
      if (!value.textBody?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "textBody é obrigatório para evidência textual.",
          path: ["textBody"],
        });
      }
    }
  });

const workbenchResponseFields = {
  questionId: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  notes: z.string().optional(),
  expectedRevision: z.number().int().positive().nullable().optional(),
  evidence: evidenceSchema.optional(),
  evidences: z.array(evidenceSchema).min(1).max(MAX_EVIDENCES_PER_SAVE).optional(),
};

function refineEvidenceCollection(
  value: { evidence?: unknown; evidences?: unknown },
  ctx: z.RefinementCtx,
) {
  if (value.evidence && value.evidences) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Use evidence ou evidences, não ambos.",
      path: ["evidences"],
    });
  }
}

export const workbenchResponseItemSchema = z
  .object(workbenchResponseFields)
  .superRefine(refineEvidenceCollection);

export const workbenchResponseBodySchema = z
  .object({ cycleId: z.string().uuid(), ...workbenchResponseFields })
  .superRefine(refineEvidenceCollection);
export type WorkbenchResponseBody = z.infer<typeof workbenchResponseBodySchema>;

type SaveContext = { userId: string; organizationId: string };

type SaveFailure = {
  ok: false;
  status: number;
  error: string;
  fields?: YesEvidenceFieldErrors;
};

const RESPONSE_REVISION_CONFLICT_MESSAGE =
  "Esta resposta foi alterada em outra aba ou por outro usuário. Recarregue o diagnóstico antes de salvar novamente.";

const QUESTION_NOT_IN_REOPEN_SCOPE_MESSAGE =
  "Este critério está fora do escopo da reabertura parcial e não pode ser alterado.";

/**
 * Converte códigos de domínio de `apply_workbench_response` em HTTP 409.
 * A guarda de reabertura parcial vive nessa RPC (`app_private.is_cycle_question_collection_editable`).
 * Não chamar a função privada via `supabase.rpc`: ela não existe no schema público e o
 * PostgREST responde PGRST202, mascarado na UI como “recurso temporariamente indisponível”.
 */
export function mapApplyWorkbenchResponseError(error: {
  message?: string | null;
  details?: string | null;
}): SaveFailure | null {
  const message = `${error.message ?? ""} ${error.details ?? ""}`;
  if (hasDatabaseErrorCode(message, "response_revision_conflict")) {
    return { ok: false, status: 409, error: RESPONSE_REVISION_CONFLICT_MESSAGE };
  }
  if (hasDatabaseErrorCode(message, "question_not_in_reopen_scope")) {
    return { ok: false, status: 409, error: QUESTION_NOT_IN_REOPEN_SCOPE_MESSAGE };
  }
  return null;
}

const formQuestionSchema = z.object({
  question_version_id: z.string().uuid(),
  question_versions: z.object({
    question_id: z.string().uuid(),
    evidence_parameter: z.unknown(),
  }),
});

const existingResponseSchema = z.object({
  id: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
  admin_proof_status: adminProofStatusSchema.nullable().optional(),
});

const existingEvidenceSchema = z.object({
  kind: z.enum(["file", "link", "text"]).optional(),
  title: z.string().nullable().optional(),
  text_body: z.string().nullable().optional(),
  original_filename: z.string().nullable(),
  storage_path: z.string().nullable(),
  external_link: z.string().nullable(),
  link_reason: z.string().nullable(),
  validation_status: z.string(),
});

type ExistingEvidenceRow = z.infer<typeof existingEvidenceSchema>;

const responseMutationResultSchema = z.object({
  responseId: z.string().uuid(),
  answer: z.enum(["yes", "no", "not_applicable"]),
  notes: z.string().nullable(),
  revision: z.number().int().positive(),
  retiredStoragePath: z.string().nullable(),
});

function evidenceInputFromRequest(
  evidence: NonNullable<WorkbenchResponseBody["evidence"]>,
): {
  kind: "file" | "link" | "text";
  title: string;
  storagePath: string | null;
  externalLink: string | null;
  textBody: string | null;
} {
  return {
    kind: evidence.kind,
    title: evidence.title,
    storagePath: evidence.kind === "file" ? (evidence.storagePath ?? null) : null,
    externalLink: evidence.kind === "link" ? (evidence.externalLink ?? null) : null,
    textBody: evidence.kind === "text" ? (evidence.textBody ?? null) : null,
  };
}

function evidenceInputFromRow(row: ExistingEvidenceRow | null): {
  kind: "file" | "link" | "text" | null;
  title: string | null;
  storagePath: string | null;
  externalLink: string | null;
  textBody: string | null;
} | null {
  if (!row) return null;
  if (row.kind === "text" || row.text_body) {
    return {
      kind: "text",
      title: row.title ?? "Comprovação textual",
      storagePath: null,
      externalLink: null,
      textBody: row.text_body ?? null,
    };
  }
  if (row.storage_path) {
    return {
      kind: "file",
      title: row.title ?? row.original_filename,
      storagePath: row.storage_path,
      externalLink: null,
      textBody: null,
    };
  }
  if (row.external_link) {
    return {
      kind: "link",
      title: row.title ?? row.link_reason ?? row.external_link,
      storagePath: null,
      externalLink: row.external_link,
      textBody: null,
    };
  }
  return null;
}

function evidencePayload(
  evidence: NonNullable<WorkbenchResponseBody["evidence"]>,
): Record<string, string> {
  if (evidence.kind === "file") {
    return {
      kind: "file",
      title: evidence.title,
      storage_path: evidence.storagePath!,
      pending_upload_id: evidence.pendingUploadId!,
    };
  }
  if (evidence.kind === "text") {
    return {
      kind: "text",
      title: evidence.title,
      text_body: evidence.textBody!.trim(),
    };
  }
  return {
    kind: "link",
    title: evidence.title,
    external_link: evidence.externalLink!,
    link_reason: linkReasonFromRequest(evidence),
  };
}

function linkReasonFromRequest(
  evidence: Pick<
    NonNullable<WorkbenchResponseBody["evidence"]>,
    "description" | "title"
  >,
): string {
  return evidence.description.trim() || evidence.title.trim() || EVIDENCE_LINK_REASON_FALLBACK;
}

export function isUnchangedRequestedLinkEvidence(
  existing: {
    validationStatus: string;
    externalLink: string | null;
    linkReason: string | null;
  },
  evidence: WorkbenchResponseBody["evidence"],
): boolean {
  return Boolean(
    evidence?.kind === "link" &&
      existing.validationStatus === "adjustment_requested" &&
      existing.externalLink === evidence.externalLink &&
      existing.linkReason === linkReasonFromRequest(evidence),
  );
}

/**
 * Salva resposta e evidência em uma única RPC.
 * Recomendações oficiais só são materializadas após a validação completa do
 * diagnóstico. A limpeza física do Storage fica fora da transação do banco.
 */
export async function saveWorkbenchResponseWithEvidence(
  supabase: SupabaseClient,
  ctx: SaveContext,
  data: WorkbenchResponseBody,
): Promise<
  | {
      ok: true;
      cycleId: string;
      response: { id: string; answer: string; notes: string | null; revision: number };
      evidenceCleanupPending: boolean;
    }
  | SaveFailure
> {
  const { cycleId, questionId, answer, notes, evidence, expectedRevision } = data;
  const requestedEvidences = data.evidences ?? (evidence ? [evidence] : []);
  const { userId, organizationId } = ctx;

  const cycle = await new CycleStateService(supabase).find(cycleId);
  if (!cycle) {
    return { ok: false, status: 404, error: "Diagnóstico não encontrado." };
  }
  if (cycle.organizationId !== organizationId) {
    return {
      ok: false,
      status: 403,
      error: "Diagnóstico fora do escopo da organização autorizada.",
    };
  }
  if (isCycleCompleted(cycle.state)) {
    return {
      ok: false,
      status: 403,
      error: "Diagnóstico concluído. Novas respostas estão bloqueadas; solicite reabertura ao administrador.",
    };
  }
  if (!isRespondentCollectionEditable(cycle.state, cycle.responseCollectionPausedAt)) {
    return {
      ok: false,
      status: 409,
      error: cycle.responseCollectionPausedAt
        ? "A coleta deste diagnóstico está temporariamente suspensa pela administração."
        : "As respostas estão bloqueadas nesta etapa do diagnóstico: " +
          `${cycleStateLabelOrFallback(cycle.state)}. Aguarde a validação ou uma solicitação de ajuste.`,
    };
  }

  const { data: formQuestionData, error: linkError } = await supabase
    .from("form_questions")
    .select(
      "question_version_id, question_versions!inner(question_id, prompt, evidence_parameter, fami_enabled, applies_to_respondent)",
    )
    .eq("form_version_id", cycle.formVersionId)
    .eq("question_versions.question_id", questionId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!formQuestionData) {
    return { ok: false, status: 400, error: "Pergunta não pertence a este formulário." };
  }
  const formQuestion = formQuestionSchema.parse(formQuestionData);
  const questionVersionId = formQuestion.question_version_id;
  const question = formQuestion.question_versions;
  const requiresEvidence = isEvidenceRequired({ evidence_parameter: question.evidence_parameter });

  if (requestedEvidences.length > 0 && (answer !== "yes" || !requiresEvidence)) {
    return {
      ok: false,
      status: 400,
      error: "Evidência só pode ser enviada junto com resposta Sim em pergunta que exige anexo.",
    };
  }

  if (answer === "not_applicable") {
    const naCheck = validateNaJustification(notes);
    if (!naCheck.ok) {
      return { ok: false, status: 400, error: naCheck.message };
    }
  }

  const { data: existingResponseData, error: responseLookupError } = await supabase
    .from("responses")
    .select("id, answer, notes, revision, admin_proof_status")
    .eq("cycle_id", cycle.id)
    .eq("question_version_id", questionVersionId)
    .maybeSingle();
  if (responseLookupError) throw responseLookupError;
  const existingResponse = existingResponseData
    ? existingResponseSchema.parse(existingResponseData)
    : null;

  let existingEvidences: ExistingEvidenceRow[] = [];
  if (existingResponse) {
    const { data: evidenceData, error: evidenceLookupError } = await supabase
      .from("evidences")
      .select(
        "kind, title, text_body, original_filename, storage_path, external_link, link_reason, validation_status",
      )
      .eq("response_id", existingResponse.id)
      .is("deactivated_at", null);
    if (evidenceLookupError) throw evidenceLookupError;
    existingEvidences = z.array(existingEvidenceSchema).parse(evidenceData ?? []);
  }

  if (cycle.state === "awaiting_adjustment") {
    const hasAdjustmentRequest = existingEvidences.some(
      (item) => item.validation_status === "adjustment_requested",
    );
    const proofRequested =
      existingResponse?.admin_proof_status === "proof_requested";
    if (!existingResponse || (!hasAdjustmentRequest && !proofRequested)) {
      return {
        ok: false,
        status: 409,
        error: "Esta pergunta não foi devolvida para correção. Os demais itens permanecem somente para consulta.",
      };
    }
    if (answer !== existingResponse.answer || (notes ?? null) !== existingResponse.notes) {
      return {
        ok: false,
        status: 409,
        error: "Durante a correção, somente as evidências devolvidas podem ser alteradas.",
      };
    }
    if (requestedEvidences.length === 0) {
      return {
        ok: false,
        status: 422,
        error: "Envie ao menos uma nova evidência para resolver a pendência.",
      };
    }
  }

  if (
    answer === "yes" &&
    requiresEvidence &&
    (requestedEvidences.length > 0 || existingEvidences.length > 0)
  ) {
    const requestInput = requestedEvidences[0]
      ? evidenceInputFromRequest(requestedEvidences[0])
      : { kind: null };
    const serverInput = existingEvidences
      .map(evidenceInputFromRow)
      .find((item) => item !== null) ?? null;
    const validation = validateYesWithEvidence(requestInput, serverInput);
    if (!validation.ok) {
      return {
        ok: false,
        status: 400,
        error: formatYesEvidenceErrors(validation.errors),
        fields: validation.errors,
      };
    }
  }

  if (
    requestedEvidences.some((requestedEvidence) =>
      existingEvidences.some((existingEvidence) =>
        isUnchangedRequestedLinkEvidence(
          {
            validationStatus: existingEvidence.validation_status,
            externalLink: existingEvidence.external_link,
            linkReason: existingEvidence.link_reason,
          },
          requestedEvidence,
        ),
      ),
    )
  ) {
    return {
      ok: false,
      status: 422,
      error:
        "O link continua igual ao que recebeu solicitação de ajuste. Altere o link ou sua descrição antes de reenviar.",
    };
  }

  for (const requestedEvidence of requestedEvidences) {
    if (requestedEvidence.kind !== "file") continue;
    if (!isEvidenceStoragePathForCycle(requestedEvidence.storagePath, {
      organizationId,
      cycleId: cycle.id,
    })) {
      return {
        ok: false,
        status: 400,
        error: "Caminho de arquivo inválido. Faça o upload novamente.",
      };
    }
  }

  const { data: transactionData, error: transactionError } = await supabase.rpc(
    "apply_workbench_response",
    {
      p_cycle_id: cycle.id,
      p_actor_user_id: userId,
      p_question_version_id: questionVersionId,
      p_answer: answer,
      p_notes: notes ?? null,
      p_expected_revision: expectedRevision ?? undefined,
      p_evidence:
        requestedEvidences.length > 0
          ? requestedEvidences.map(evidencePayload)
          : null,
    },
  );
  if (transactionError) {
    const mapped = mapApplyWorkbenchResponseError(transactionError);
    if (mapped) return mapped;
    throw transactionError;
  }
  const transaction = responseMutationResultSchema.parse(transactionData);

  let evidenceCleanupPending = false;
  if (transaction.retiredStoragePath) {
    const { error: storageError } = await supabase.storage
      .from("evidencias")
      .remove([transaction.retiredStoragePath]);
    if (storageError) {
      evidenceCleanupPending = true;
    }
  }

  if (answer !== "yes" || !requiresEvidence) {
    const cleanup = await purgeRetiredUnsnapshottedEvidence(supabase, transaction.responseId);
    evidenceCleanupPending ||= cleanup.cleanupPending;
  }

  return {
    ok: true,
    cycleId: cycle.id,
    response: {
      id: transaction.responseId,
      answer: transaction.answer,
      notes: transaction.notes,
      revision: transaction.revision,
    },
    evidenceCleanupPending,
  };
}
