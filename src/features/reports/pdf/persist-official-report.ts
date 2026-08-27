import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { REPORTS_BUCKET } from "@/features/reports/pdf/report-file-path";
import { buildOfficialReportPdf } from "@/features/reports/pdf/pdf";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";

/**
 * Emissão oficial em duas fases:
 * 1. reserva identidade/versão sob lock;
 * 2. gera e envia o PDF identificado;
 * 3. valida hash, tamanho, Storage, ciclo e revisão do plano na finalização.
 */
export type PersistOfficialReportInput = {
  data: OfficialReportData;
  generatedBy: string;
  reissueReason?: string | null;
};

export type PersistOfficialReportResult = {
  cycleId: string;
  cycleProcessingId: string;
  reportId: string;
  emissionVersion: number;
  filePath: string;
  fileSha256: string;
  contentSha256: string;
  pdfBytes: Uint8Array;
};

const reservationSchema = z.object({
  id: z.string().uuid(),
  emission_version: z.number().int().positive(),
  file_path: z.string().min(1),
  generated_at: z.string(),
  generated_by_name: z.string().nullable(),
  reissue_reason: z.string().nullable(),
  reference_start_year: z.number().int(),
  reference_end_year: z.number().int(),
  action_plan_revision: z.number().int().nonnegative(),
});

const finalizedEmissionSchema = reservationSchema.extend({
  status: z.literal("completed"),
  file_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  content_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  file_size_bytes: z.number().int().positive(),
});

export class OfficialReportPersistError extends Error {
  constructor(
    message: string,
    readonly code:
      | "cycle_not_resolved"
      | "reservation_failed"
      | "upload_failed"
      | "report_persist_failed",
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "OfficialReportPersistError";
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function cancelReservation(
  supabase: TypedSupabaseClient,
  reportId: string,
  filePath: string,
  removeFile: boolean,
): Promise<void> {
  const cleanupErrors: unknown[] = [];
  if (removeFile) {
    const { error } = await supabase.storage.from(REPORTS_BUCKET).remove([filePath]);
    if (error) cleanupErrors.push(error);
  }
  const { error: cancelError } = await supabase.rpc("cancel_report_emission", {
    p_report_id: reportId,
  });
  if (cancelError) cleanupErrors.push(cancelError);
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Falha ao limpar uma emissão incompleta.");
  }
}

export async function persistOfficialReport(
  supabase: TypedSupabaseClient,
  { data, generatedBy, reissueReason }: PersistOfficialReportInput,
): Promise<PersistOfficialReportResult> {
  const { cycleId, cycleProcessingId } = data;
  if (!cycleId || !cycleProcessingId) {
    throw new OfficialReportPersistError(
      "Não foi possível resolver o diagnóstico/processamento para esta emissão.",
      "cycle_not_resolved",
    );
  }

  const { data: reservedRaw, error: reserveError } = await supabase.rpc(
    "reserve_report_emission",
    {
      p_cycle_id: cycleId,
      p_cycle_processing_id: cycleProcessingId,
      p_generated_by: generatedBy,
      p_expected_action_plan_revision: data.actionPlanRevision,
      p_generated_at: data.generatedAtIso,
      p_reissue_reason: reissueReason?.trim() || undefined,
    },
  );
  const reserved = reservationSchema.safeParse(reservedRaw);
  if (reserveError || !reserved.success) {
    throw new OfficialReportPersistError(
      "Falha ao reservar a identidade da emissão oficial.",
      "reservation_failed",
      { cause: reserveError ?? reserved.error },
    );
  }

  if (reserved.data.action_plan_revision !== data.actionPlanRevision) {
    throw new OfficialReportPersistError(
      "A revisão reservada do plano de ação diverge dos dados carregados.",
      "reservation_failed",
    );
  }

  const identityBase = {
    reportId: reserved.data.id,
    emissionVersion: reserved.data.emission_version,
    generatedByLabel:
      reserved.data.generated_by_name?.trim() || "Administração da plataforma",
    generatedAtIso: reserved.data.generated_at,
    reissueReason: reserved.data.reissue_reason,
  };
  const { tracking: _tracking, ...dataWithoutTracking } = data;
  const dataForFingerprint: OfficialReportData = {
    ...dataWithoutTracking,
    generatedAtIso: reserved.data.generated_at,
    referenceYear: reserved.data.reference_start_year,
    referenceStartYear: reserved.data.reference_start_year,
    referenceEndYear: reserved.data.reference_end_year,
    referencePeriodLabel:
      reserved.data.reference_start_year === reserved.data.reference_end_year
        ? String(reserved.data.reference_start_year)
        : `${reserved.data.reference_start_year}–${reserved.data.reference_end_year}`,
    document: null,
  };
  const contentSha256 = sha256(
    canonicalJson({ ...dataForFingerprint, documentIdentity: identityBase }),
  );
  const reportData: OfficialReportData = {
    ...dataForFingerprint,
    document: { ...identityBase, contentSha256 },
  };

  let uploaded = false;
  let pdfBytes: Uint8Array | null = null;
  let fileSha256: string | null = null;
  let fileSizeBytes: number | null = null;
  try {
    pdfBytes = await buildOfficialReportPdf(reportData);
    fileSha256 = sha256(pdfBytes);
    fileSizeBytes = pdfBytes.byteLength;

    const { error: uploadError } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(reserved.data.file_path, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new OfficialReportPersistError(
        "Falha ao persistir o PDF do relatório no Storage.",
        "upload_failed",
        { cause: uploadError },
      );
    }
    uploaded = true;

    const { data: finalizedRaw, error: finalizeError } = await supabase.rpc(
      "finalize_report_emission",
      {
        p_report_id: reserved.data.id,
        p_file_sha256: fileSha256,
        p_content_sha256: contentSha256,
        p_file_size_bytes: fileSizeBytes,
      },
    );
    const finalized = finalizedEmissionSchema.safeParse(finalizedRaw);
    if (finalizeError || !finalized.success) {
      throw new OfficialReportPersistError(
        "Falha ao finalizar a emissão oficial do relatório.",
        "report_persist_failed",
        { cause: finalizeError ?? finalized.error },
      );
    }

    if (finalized.data.file_path !== reserved.data.file_path) {
      throw new OfficialReportPersistError(
        "A emissão oficial retornou um caminho de arquivo divergente.",
        "report_persist_failed",
      );
    }

    return {
      cycleId,
      cycleProcessingId,
      reportId: finalized.data.id,
      emissionVersion: finalized.data.emission_version,
      filePath: finalized.data.file_path,
      fileSha256,
      contentSha256,
      pdfBytes,
    };
  } catch (error) {
    // Uma resposta de rede inesperada pode ocorrer depois do commit da RPC.
    // Reconcilia a emissão pelo banco antes de qualquer compensação, evitando
    // apagar ou duplicar um documento que já foi finalizado com sucesso.
    const { data: currentRawData } = await supabase
      .from("reports")
      .select(
        "id,status,emission_version,file_path,generated_at,generated_by_name," +
          "reissue_reason,reference_start_year,reference_end_year,action_plan_revision," +
          "file_sha256,content_sha256,file_size_bytes",
      )
      .eq("id", reserved.data.id)
      .maybeSingle();
    const currentRaw = currentRawData as {
      id: string;
      status: string;
      emission_version: number;
      file_path: string;
      generated_at: string;
      generated_by_name: string | null;
      reissue_reason: string | null;
      reference_start_year: number | null;
      reference_end_year: number | null;
      action_plan_revision: number | null;
      file_sha256: string | null;
      content_sha256: string | null;
      file_size_bytes: number | null;
    } | null;
    const current = finalizedEmissionSchema.safeParse(currentRaw);
    if (
      current.success &&
      pdfBytes &&
      fileSha256 &&
      fileSizeBytes != null &&
      current.data.file_path === reserved.data.file_path &&
      current.data.file_sha256 === fileSha256 &&
      current.data.content_sha256 === contentSha256 &&
      current.data.file_size_bytes === fileSizeBytes
    ) {
      return {
        cycleId,
        cycleProcessingId,
        reportId: current.data.id,
        emissionVersion: current.data.emission_version,
        filePath: current.data.file_path,
        fileSha256,
        contentSha256,
        pdfBytes,
      };
    }

    if (currentRaw?.status !== "completed") {
      await cancelReservation(
        supabase,
        reserved.data.id,
        reserved.data.file_path,
        uploaded,
      );
    }
    if (error instanceof OfficialReportPersistError) throw error;
    throw new OfficialReportPersistError(
      "Falha ao emitir e persistir o relatório oficial.",
      "report_persist_failed",
      { cause: error },
    );
  }
}
