import { z } from "zod";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

/**
 * Chamadas ao workbench via sessão autenticada (cookie).
 * As operações recebem somente `cycleId`: formulário e organização são
 * derivados no servidor a partir do ciclo.
 */

const WORKBENCH_PREFIX = "/api/workbench";

const uploadInitializationSchema = z.object({
  pendingUploadId: z.string().uuid(),
  storagePath: z.string().min(1),
  bucket: z.string().min(1),
  uploadToken: z.string().min(1),
}).passthrough();

type WorkbenchIdentifiers = {
  cycleId: string;
};

function sessionInit(method: string, body?: object): RequestInit {
  return {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

export async function fetchWorkbenchData(
  ids: WorkbenchIdentifiers,
  options?: { signal?: AbortSignal },
) {
  const params = new URLSearchParams({ cycleId: ids.cycleId });
  return fetch(`${WORKBENCH_PREFIX}/data?${params.toString()}`, {
    ...sessionInit("GET"),
    signal: options?.signal,
  });
}

export type WorkbenchEvidencePayload = {
  kind: "file" | "link" | "text";
  title: string;
  description?: string;
  storagePath?: string;
  pendingUploadId?: string;
  externalLink?: string;
  textBody?: string;
};

export async function submitWorkbenchResponse(
  ids: WorkbenchIdentifiers,
  payload: {
    questionId: string;
    answer: "yes" | "no" | "not_applicable";
    notes: string;
    expectedRevision?: number | null;
    evidence?: WorkbenchEvidencePayload;
    evidences?: WorkbenchEvidencePayload[];
  },
) {
  const body: Record<string, unknown> = {
    cycleId: ids.cycleId,
    questionId: payload.questionId,
    answer: payload.answer,
    notes: payload.notes,
    expectedRevision: payload.expectedRevision ?? null,
  };
  if (payload.evidence) body.evidence = payload.evidence;
  if (payload.evidences?.length) body.evidences = payload.evidences;
  return fetch(`${WORKBENCH_PREFIX}/response`, sessionInit("POST", body));
}

export async function removeEvidenceAttachment(
  ids: WorkbenchIdentifiers,
  payload: {
    questionId?: string;
    evidenceId?: string | null;
    pendingUploadId?: string | null;
    expectedRevision?: number | null;
  },
) {
  const body: Record<string, unknown> = { cycleId: ids.cycleId };
  if (payload.questionId) body.questionId = payload.questionId;
  if (payload.evidenceId) body.evidenceId = payload.evidenceId;
  if (payload.expectedRevision != null) body.expectedRevision = payload.expectedRevision;
  if (payload.pendingUploadId) {
    body.pendingUploadId = payload.pendingUploadId;
  }
  return fetch(`${WORKBENCH_PREFIX}/evidence/remove`, sessionInit("POST", body));
}

export async function uploadEvidenceFile(ids: WorkbenchIdentifiers, file: File) {
  const initResponse = await fetch(
    `${WORKBENCH_PREFIX}/evidence/upload`,
    sessionInit("POST", {
      cycleId: ids.cycleId,
      filename: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    }),
  );
  if (!initResponse.ok) return initResponse;

  const initialized = await parseJson(initResponse, uploadInitializationSchema);
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(initialized.bucket)
    .uploadToSignedUrl(initialized.storagePath, initialized.uploadToken, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    await removeEvidenceAttachment(ids, {
      pendingUploadId: initialized.pendingUploadId,
    }).catch(() => undefined);
    return new Response(JSON.stringify({ error: "Não foi possível enviar o arquivo." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return fetch(
    `${WORKBENCH_PREFIX}/evidence/upload`,
    sessionInit("PATCH", {
      cycleId: ids.cycleId,
      pendingUploadId: initialized.pendingUploadId,
    }),
  );
}


export type WorkbenchResponsePayload = {
  questionId: string;
  answer: "yes" | "no" | "not_applicable";
  notes: string;
  expectedRevision?: number | null;
  evidence?: WorkbenchEvidencePayload;
  evidences?: WorkbenchEvidencePayload[];
};

export async function submitWorkbenchResponses(
  ids: WorkbenchIdentifiers,
  responses: WorkbenchResponsePayload[],
) {
  return fetch(
    `${WORKBENCH_PREFIX}/responses/batch`,
    sessionInit("POST", { cycleId: ids.cycleId, responses }),
  );
}

/** Envia o ciclo aberto do respondente pela rota canônica centrada no ciclo. */
export async function submitRespondentCycle(cycleId: string) {
  return fetch(`/api/respondent/cycles/${cycleId}/submit`, sessionInit("POST", {}));
}
