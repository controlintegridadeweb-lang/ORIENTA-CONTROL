import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadOfficialReportData } from "@/features/reports/pdf/build-official-report-data";
import { resolveCycleReportScope } from "@/features/reports/pdf/cycle-report-read";
import {
  persistOfficialReport,
  OfficialReportPersistError,
} from "@/features/reports/pdf/persist-official-report";
import { requireAuth } from "@/infrastructure/api/auth";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { logError } from "@/infrastructure/observability/logger";


function safeReportFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

const bodySchema = z.object({
  cycleId: z.string().uuid(),
  processingVersion: z.number().int().positive().optional(),
  reissueReason: z.string().trim().min(3).max(1000).optional(),
}).strict();

/**
 * Emissão ou reemissão administrativa do PDF oficial de uma avaliação encerrada.
 * A primeira emissão é iniciada automaticamente no encerramento; esta rota também
 * recupera falhas dessa emissão e cria reemissões auditadas.
 * Consultas do respondente usam somente `/api/reports/[reportId]/download`.
 */
export async function POST(request: Request) {
  const { context, error } = await requireAuth(request, ["admin"]);
  if (error) return error;

  let payload: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const scope = await resolveCycleReportScope(supabase, payload.cycleId);
  if (!scope) return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });

  try {
    const data = await loadOfficialReportData(payload, supabase);
    if (!data) {
      return NextResponse.json(
        { error: "Nenhum processamento concluído com Resultado FAMI oficial foi encontrado para este diagnóstico." },
        { status: 404 },
      );
    }

    const { count: existingEmissionCount, error: emissionsError } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("cycle_processing_id", data.cycleProcessingId)
      .in("status", ["completed", "legacy"]);
    if (emissionsError) throw emissionsError;
    if ((existingEmissionCount ?? 0) > 0 && !payload.reissueReason) {
      return NextResponse.json(
        { error: "Informe o motivo da reemissão para criar uma nova versão do relatório." },
        { status: 422 },
      );
    }

    try {
      const emitted = await persistOfficialReport(supabase, {
        data,
        generatedBy: context.userId,
        reissueReason: payload.reissueReason,
      });
      return new NextResponse(Buffer.from(emitted.pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="relatorio-orienta-${safeReportFilenamePart(data.formName) || "diagnostico"}-${safeReportFilenamePart(data.referencePeriodLabel)}-processamento-${data.processingVersion}-emissao-${emitted.emissionVersion}-${emitted.reportId.slice(0, 8)}.pdf"`,
          "X-Report-Id": emitted.reportId,
          "X-Report-SHA256": emitted.fileSha256,
        },
      });
    } catch (persistError) {
      if (persistError instanceof OfficialReportPersistError) {
        const causeMessage =
          persistError.cause instanceof Error
            ? persistError.cause.message
            : typeof persistError.cause === "object" &&
                persistError.cause &&
                "message" in persistError.cause
              ? String((persistError.cause as { message?: unknown }).message ?? "")
              : "";
        if (hasDatabaseErrorCode(causeMessage, "cycle_not_completed")) {
          return NextResponse.json(
            {
              error:
                "O relatório oficial só pode ser emitido após encerrar a avaliação. No diagnóstico, use “Encerrar avaliação” (situação Avaliação encerrada).",
            },
            { status: 422 },
          );
        }
        if (hasDatabaseErrorCode(causeMessage, "reissue_reason_required")) {
          return NextResponse.json(
            { error: "Informe o motivo da reemissão para criar uma nova versão do relatório." },
            { status: 422 },
          );
        }
        if (hasDatabaseErrorCode(causeMessage, "cycle_reference_period_required")) {
          return NextResponse.json(
            { error: "Defina o período de referência estruturado do diagnóstico antes de emitir o relatório." },
            { status: 422 },
          );
        }
        if (hasDatabaseErrorCode(causeMessage, "report_action_plan_changed")) {
          return NextResponse.json(
            { error: "O plano de ação foi alterado durante a emissão. Recarregue os dados e emita novamente." },
            { status: 409 },
          );
        }
        if (hasDatabaseErrorCode(causeMessage, "cycle_processing_not_completed")) {
          return NextResponse.json(
            { error: "O processamento FAMI deste diagnóstico ainda não está concluído." },
            { status: 422 },
          );
        }
        const { error: failureRecordError } = await supabase.rpc(
          "record_report_emission_failure",
          {
            p_cycle_id: data.cycleId,
            p_cycle_processing_id: data.cycleProcessingId,
            p_action_plan_revision: data.actionPlanRevision,
            p_attempted_by: context.userId,
            p_error_code: persistError.code,
            p_error_message: (causeMessage.trim() || persistError.message).slice(0, 2000),
          },
        );
        if (failureRecordError) {
          logError("Failed to record manual report emission failure", failureRecordError, {
            route: "/api/reports/official",
            cycleId: data.cycleId,
          });
        }
        logError("Failed to persist official report", persistError, {
          route: "/api/reports/official",
          code: persistError.code,
          cycleId: scope.cycleId,
        });
        return NextResponse.json({ error: "Falha ao emitir e persistir o relatório oficial." }, { status: 500 });
      }
      throw persistError;
    }
  } catch (cause) {
    if (hasDatabaseErrorCode(cause, "report_reference_period_unresolved")) {
      return NextResponse.json(
        { error: "Defina o ano inicial e o ano final do período de referência antes de emitir o relatório oficial." },
        { status: 422 },
      );
    }
    if (hasDatabaseErrorCode(cause, "report_action_plan_not_closed")) {
      return NextResponse.json(
        { error: "O relatório oficial não pode ser emitido porque ainda há recomendações sem tratamento concluído no plano de ação." },
        { status: 409 },
      );
    }
    logError("Failed to build report PDF", cause, { route: "/api/reports/official", cycleId: scope.cycleId });
    return NextResponse.json({ error: "Falha ao emitir relatório." }, { status: 500 });
  }
}
