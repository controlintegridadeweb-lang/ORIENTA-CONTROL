import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { logInfo } from "@/infrastructure/observability/logger";

export type CycleReferencePeriod = {
  cycleId: string;
  referenceStartYear: number;
  referenceEndYear: number;
};

function validateReferencePeriod(startYear: number, endYear: number): void {
  const issues: Array<{ path: string; message: string }> = [];
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2199) {
    issues.push({ path: "referenceStartYear", message: "Informe um ano inicial válido." });
  }
  if (!Number.isInteger(endYear) || endYear < 1900 || endYear > 2199) {
    issues.push({ path: "referenceEndYear", message: "Informe um ano final válido." });
  } else if (Number.isInteger(startYear) && endYear < startYear) {
    issues.push({
      path: "referenceEndYear",
      message: "O ano final não pode ser anterior ao ano inicial.",
    });
  }
  if (issues.length > 0) throw new DomainValidationError(issues);
}

/**
 * Define a referência institucional de um diagnóstico legado. Depois da
 * primeira emissão oficial, o período documental permanece imutável.
 */
export async function setCycleReferencePeriod(
  supabase: SupabaseClient,
  input: CycleReferencePeriod & { actorUserId: string },
): Promise<CycleReferencePeriod> {
  validateReferencePeriod(input.referenceStartYear, input.referenceEndYear);

  const { data, error } = await supabase.rpc("set_cycle_reference_period", {
    p_cycle_id: input.cycleId,
    p_reference_start_year: input.referenceStartYear,
    p_reference_end_year: input.referenceEndYear,
    p_actor_user_id: input.actorUserId,
  });
  if (error) {
    if (hasDatabaseErrorCode(error, "cycle_not_found")) {
      throw new DomainNotFoundError("Diagnóstico não encontrado.");
    }
    if (hasDatabaseErrorCode(error, "cycle_reference_period_locked")) {
      throw new DomainConflictError(
        "A referência não pode ser alterada porque já existe uma emissão oficial para este diagnóstico.",
      );
    }
    if (hasDatabaseErrorCode(error, "cycle_reference_period_invalid")) {
      throw new DomainValidationError([
        { path: "referenceStartYear", message: "Período de referência inválido." },
      ]);
    }
    throw error;
  }

  const cycle = data as { id: string; reference_start_year: number | null; reference_end_year: number | null } | null;
  if (!cycle?.id || cycle.reference_start_year == null || cycle.reference_end_year == null) {
    throw new DomainConflictError("A referência do diagnóstico não pôde ser atualizada.");
  }

  logInfo("cycle.reference_period_updated", {
    cycleId: cycle.id,
    actorUserId: input.actorUserId,
    referenceStartYear: cycle.reference_start_year,
    referenceEndYear: cycle.reference_end_year,
  });

  return {
    cycleId: cycle.id,
    referenceStartYear: cycle.reference_start_year,
    referenceEndYear: cycle.reference_end_year,
  };
}
