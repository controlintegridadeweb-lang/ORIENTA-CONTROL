import "server-only";

import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { logError } from "@/infrastructure/observability/logger";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import { CycleStateService, type CycleRow } from "@/features/cycles/cycle-state-service";
import { loadOfficialReportData } from "@/features/reports/pdf/build-official-report-data";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import {
  OfficialReportPersistError,
  persistOfficialReport,
} from "@/features/reports/pdf/persist-official-report";
import {
  reportLifecycleStatusSchema,
  type ReportLifecycleStatus,
} from "@/shared/domain/report-lifecycle";

export type CycleReportEmissionResult = {
  status: ReportLifecycleStatus;
  reportId: string | null;
  emissionVersion: number | null;
  message: string | null;
};

export type CycleClosureResult = {
  cycle: CycleRow;
  report: CycleReportEmissionResult;
};

function failureMetadata(error: unknown): { code: string; message: string } {
  if (error instanceof OfficialReportPersistError) {
    const causeMessage =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === "object" && error.cause && "message" in error.cause
          ? String((error.cause as { message?: unknown }).message ?? "")
          : "";
    return {
      code: error.code,
      message: causeMessage.trim() || error.message,
    };
  }
  if (error instanceof Error) {
    return { code: "unexpected_error", message: error.message };
  }
  return { code: "unexpected_error", message: "Falha não identificada na emissão oficial." };
}

export class CycleClosureService {
  private readonly cycleService: CycleStateService;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.cycleService = new CycleStateService(supabase);
  }

  async reportStatus(cycleId: string): Promise<ReportLifecycleStatus> {
    const { data, error } = await this.supabase.rpc("cycle_report_lifecycle_status", {
      p_cycle_id: cycleId,
    });
    if (error) throw error;
    return reportLifecycleStatusSchema.parse(data);
  }

  private async recordFailure(
    cycleId: string,
    actorUserId: string,
    error: unknown,
    context?: { cycleProcessingId: string; actionPlanRevision: number },
  ): Promise<CycleReportEmissionResult> {
    const failure = failureMetadata(error);
    let resolvedContext = context ?? null;
    if (!resolvedContext) {
      const [{ data: cycleRow }, { data: processingRows }] = await Promise.all([
        this.supabase
          .from("cycles")
          .select("action_plan_revision")
          .eq("id", cycleId)
          .maybeSingle(),
        this.supabase
          .from("cycle_processings")
          .select("id,processing_version")
          .eq("cycle_id", cycleId)
          .eq("status", "completed")
          .order("processing_version", { ascending: false })
          .limit(1),
      ]);
      const processing = processingRows?.[0];
      if (cycleRow && processing) {
        resolvedContext = {
          cycleProcessingId: processing.id,
          actionPlanRevision: Number(cycleRow.action_plan_revision ?? 0),
        };
      }
    }

    if (resolvedContext) {
      const { error: recordError } = await this.supabase.rpc(
        "record_report_emission_failure",
        {
          p_cycle_id: cycleId,
          p_cycle_processing_id: resolvedContext.cycleProcessingId,
          p_action_plan_revision: resolvedContext.actionPlanRevision,
          p_attempted_by: actorUserId,
          p_error_code: failure.code,
          p_error_message: failure.message,
        },
      );
      if (recordError) {
        logError("Failed to record report emission failure", recordError, {
          cycleId,
          cycleProcessingId: resolvedContext.cycleProcessingId,
        });
      }
    }

    logError("Automatic official report emission failed", error, {
      cycleId,
      code: failure.code,
    });
    return {
      status: "emission_failed",
      reportId: null,
      emissionVersion: null,
      message:
        "A avaliação foi encerrada, mas a emissão automática do relatório falhou. A emissão pode ser retomada na área de Relatórios.",
    };
  }

  async ensureClosedCycleReport(
    cycleId: string,
    actorUserId: string,
  ): Promise<CycleReportEmissionResult> {
    const cycle = await this.cycleService.require(cycleId);
    if (cycle.state !== "completed") {
      throw new DomainConflictError(
        "A emissão oficial só pode ser iniciada depois do encerramento da avaliação.",
      );
    }

    const currentStatus = await this.reportStatus(cycleId);
    if (currentStatus === "available" || currentStatus === "emitting") {
      return {
        status: currentStatus,
        reportId: null,
        emissionVersion: null,
        message: null,
      };
    }

    let data: OfficialReportData;
    try {
      const loaded = await loadOfficialReportData({ cycleId }, this.supabase);
      if (!loaded) {
        throw new DomainConflictError(
          "Não há processamento FAMI oficial concluído para emitir o relatório deste diagnóstico.",
        );
      }
      data = loaded;
    } catch (error) {
      return this.recordFailure(cycleId, actorUserId, error);
    }

    try {
      const emitted = await persistOfficialReport(this.supabase, {
        data,
        generatedBy: actorUserId,
      });
      return {
        status: "available",
        reportId: emitted.reportId,
        emissionVersion: emitted.emissionVersion,
        message: null,
      };
    } catch (error) {
      return this.recordFailure(cycleId, actorUserId, error, {
        cycleProcessingId: data.cycleProcessingId,
        actionPlanRevision: data.actionPlanRevision,
      });
    }
  }

  async closeAndEmit(
    cycle: CycleRow,
    actorUserId: string,
  ): Promise<CycleClosureResult> {
    const closed =
      cycle.state === "completed"
        ? cycle
        : await this.cycleService.transition(cycle, "completed", actorUserId);
    const report = await this.ensureClosedCycleReport(closed.id, actorUserId);
    return { cycle: closed, report };
  }
}
