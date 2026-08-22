import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CycleListItem } from "./cycle-queries";

/**
 * Escopo oficial de período compartilhado (form_periods).
 * Identidade: periodId. periodLabel é só apresentação/compat.
 */

export type FormPeriodOption = {
  id: string;
  periodCode: string;
  label: string;
  formVersionId: string;
  startsAt: string | null;
  responseDeadlineAt: string | null;
  status: "open" | "closed";
};

const formPeriodRowSchema = z.object({
  id: z.string().min(1),
  period_code: z.string().min(1),
  label: z.string().min(1),
  form_version_id: z.string().min(1),
  starts_at: z.string().nullable(),
  response_deadline_at: z.string().nullable(),
  status: z.enum(["open", "closed"]),
});

export type FormPeriodScope = {
  formId: string;
  periodId: string | null;
  /** Compat de leitura: periodLabel na URL antiga. */
  legacyPeriodLabel: string | null;
  period: FormPeriodOption | null;
  periods: FormPeriodOption[];
};

/**
 * Lista períodos de um formulário (todas as versões), mais recentes primeiro.
 */
export async function listFormPeriodsForForm(
  supabase: SupabaseClient,
  formId: string,
): Promise<FormPeriodOption[]> {
  const { data: versions, error: versionsError } = await supabase
    .from("form_versions")
    .select("id")
    .eq("form_id", formId);
  if (versionsError) throw versionsError;
  const versionIds = (versions ?? []).map((v) => v.id);
  if (versionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("form_periods")
    .select("id, period_code, label, form_version_id, starts_at, response_deadline_at, status")
    .in("form_version_id", versionIds)
    .order("period_code", { ascending: false });
  if (error) throw error;

  return z.array(formPeriodRowSchema).parse(data ?? []).map((row) => ({
    id: row.id,
    periodCode: row.period_code,
    label: row.label,
    formVersionId: row.form_version_id,
    startsAt: row.starts_at,
    responseDeadlineAt: row.response_deadline_at,
    status: row.status,
  }));
}

/**
 * Resolve o período oficial a partir de periodId (preferido) ou periodLabel legado.
 */
export function resolveFormPeriodScope(input: {
  formId: string;
  periodId: string | null;
  legacyPeriodLabel: string | null;
  periods: FormPeriodOption[];
}): FormPeriodScope {
  const { formId, periodId, legacyPeriodLabel, periods } = input;

  let period: FormPeriodOption | null = null;
  if (periodId) {
    period = periods.find((p) => p.id === periodId) ?? null;
  } else if (legacyPeriodLabel) {
    period =
      periods.find(
        (p) =>
          p.periodCode === legacyPeriodLabel || p.label === legacyPeriodLabel,
      ) ?? null;
  } else if (periods.length === 1) {
    period = periods[0] ?? null;
  }

  return {
    formId,
    periodId: period?.id ?? periodId,
    legacyPeriodLabel,
    period,
    periods,
  };
}

/**
 * Ciclos do período: um por órgão (garantido por UNIQUE(period_id, organization_id)).
 * Não aplica selectLatestCyclePerOrganization quando periodId está definido.
 */
export function listCyclesForPeriod(
  cycles: CycleListItem[],
  periodId: string | null,
): CycleListItem[] {
  if (!periodId) return cycles;
  return cycles.filter((cycle) => cycle.periodId === periodId);
}

/** Prazo excepcional: ciclo difere do prazo-base do período. */
export function hasExceptionalDeadline(
  cycle: Pick<CycleListItem, "responseDeadlineAt">,
  period: Pick<FormPeriodOption, "responseDeadlineAt"> | null,
): boolean {
  if (!period?.responseDeadlineAt || !cycle.responseDeadlineAt) return false;
  return cycle.responseDeadlineAt !== period.responseDeadlineAt;
}
