import "server-only";

import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import {
  getLatestFamiVersionForCycle,
  resolveYearEndFamiVersionForCycle,
} from "@/features/fami/cycle-fami-read";
import {
  resolveLatestFamiContextForOrganization,
  resolveYearEndFamiContextForOrganization,
} from "@/features/fami/queries";

export type FamiCycleContext = {
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  cycleState: string;
  organizationId: string;
  closedAt: string | null;
  responseDeadlineAt: string | null;
};

/**
 * Uma visão de diagnóstico sempre aponta para um ciclo explícito. `latest-org`
 * é uma visão de dashboard: ela resolve, de forma determinística por data de
 * snapshot, um ciclo já processado e depois segue o mesmo caminho canônico.
 */
export type FamiScope =
  | {
      kind: "cycle";
      cycleId: string;
      processingVersion?: number;
      closingYear?: number | null;
    }
  | {
      kind: "latest-org";
      organizationId: string;
      closingYear?: number | null;
    };

type Client = ReturnType<typeof createSupabaseServiceRoleClient>;

function getClient(): Client {
  return createSupabaseServiceRoleClient();
}

/** Contexto de formulário, organização e estado de um diagnóstico específico. */
export async function loadFamiCycleContext(cycleId: string): Promise<FamiCycleContext | null> {
  const scope = await resolveCycleOperationalScope(getClient(), cycleId);
  if (!scope) return null;

  const { data, error } = await getClient()
    .from("form_versions")
    .select("version, forms!form_versions_form_id_fkey!inner(name)")
    .eq("id", scope.cycle.formVersionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const forms = data.forms as { name: string } | { name: string }[] | null;
  const form = Array.isArray(forms) ? forms[0] : forms;
  return {
    cycleId,
    formId: scope.formId,
    formName: form?.name ?? "",
    formVersion: Number(data.version ?? 1),
    cycleState: scope.cycle.state,
    organizationId: scope.cycle.organizationId,
    closedAt: scope.cycle.closedAt,
    responseDeadlineAt: scope.cycle.responseDeadlineAt,
  };
}

export async function resolveFamiContextForScope(
  scope: FamiScope,
): Promise<{ cycleId: string; processingVersion: number } | null> {
  if (scope.kind === "cycle") {
    const processingVersion =
      scope.processingVersion && scope.processingVersion > 0
        ? scope.processingVersion
        : scope.closingYear != null
          ? await resolveYearEndFamiVersionForCycle(scope.cycleId, scope.closingYear)
          : (await getLatestFamiVersionForCycle(scope.cycleId))?.processingVersion ?? null;
    return processingVersion == null ? null : { cycleId: scope.cycleId, processingVersion };
  }

  const context =
    scope.closingYear != null
      ? await resolveYearEndFamiContextForOrganization(scope.organizationId, scope.closingYear)
      : await resolveLatestFamiContextForOrganization(scope.organizationId);
  if (!context) return null;
  return { cycleId: context.cycleId, processingVersion: context.processingVersion };
}
