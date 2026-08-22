import { NextResponse } from "next/server";
import { authorizeCron } from "@/application/automation/cron-authorization";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  cleanupExpiredPendingEvidenceUploads,
  cleanupQueuedEvidenceStorageObjects,
} from "@/features/evidences/pending-evidence-uploads";
import { logError } from "@/infrastructure/observability/logger";
import {
  cleanupExpiredPendingActionPlanDocumentUploads,
  cleanupQueuedActionPlanStorageObjects,
} from "@/features/improvement-management/action-plans/document-cleanup-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  try {
    const client = createSupabaseServiceRoleClient();
    // Primeiro consome os uploads expirados e materializa suas entradas na
    // outbox. Só depois processa a exclusão física; executar as duas fases em
    // paralelo poderia apagar uma entrada recém-recriada e perder o retry.
    const [uploads, actionPlanUploads, operational] = await Promise.all([
      cleanupExpiredPendingEvidenceUploads(client),
      cleanupExpiredPendingActionPlanDocumentUploads(client),
      client.rpc("cleanup_operational_data"),
    ]);
    if (operational.error) throw operational.error;

    const [storageObjects, actionPlanStorageObjects] = await Promise.all([
      cleanupQueuedEvidenceStorageObjects(client),
      cleanupQueuedActionPlanStorageObjects(client),
    ]);
    return NextResponse.json({
      ok: true,
      uploads,
      storageObjects,
      actionPlanUploads,
      actionPlanStorageObjects,
      operational: operational.data,
    });
  } catch (error) {
    logError("Failed to clean pending evidence uploads", error, {
      route: "/api/maintenance/pending-evidence-cleanup",
    });
    return NextResponse.json({ error: "Falha ao limpar uploads temporários." }, { status: 500 });
  }
}
