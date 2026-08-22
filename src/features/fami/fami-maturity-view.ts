import "server-only";

import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { AxisMaturity } from "@/features/fami/types";
import { getCalendarYearBrt } from "@/features/fami/fami-year";
import { loadProcessingFamiQuestionMeta } from "@/features/fami/processing-question-meta";
import {
  loadFamiCycleContext,
  resolveFamiContextForScope,
  type FamiScope,
} from "@/features/fami/fami-context";
import {
  loadAxisMaturityForCycleVersion,
  loadFamiGlobalForCycleVersion,
} from "@/features/fami/cycle-fami-read";
import {
  resolveCycleProcessingIdForCycle,
  resolveCycleProcessingMetadataForCycle,
} from "@/features/fami/resolve-cycle-processing";

export type FamiMaturityView = {
  scope: FamiScope;
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  cycleState: string;
  organizationId: string;
  processingVersion: number;
  policyVersion: string;
  referenceYear: number;
  global: {
    percentage: number;
    maturityLevel: number | null;
    pointsObtained: number;
    pointsPossible: number;
  };
  axes: AxisMaturity[];
  meta: {
    applicableQuestions: number;
    waivedQuestions: number;
    notApplicableResponses: number;
    isOfficialScore: boolean;
    calculatedAt: string;
    closedAt: string | null;
    responseDeadlineAt: string | null;
  };
};

/**
 * Metadados do diagnóstico histórico: waivers e “Não se aplica” vêm do mesmo
 * snapshot imutável usado pela pontuação. O denominador reproduz a regra
 * `isEligibleForFami`, sem consultar dados vivos.
 */
async function countMetaQuestions(
  cycleId: string,
  processingVersion: number,
): Promise<{
  applicable: number;
  waived: number;
  notApplicableResponses: number;
}> {
  const client = createSupabaseServiceRoleClient();
  const { data: cycle, error: cycleError } = await client
    .from("cycles")
    .select("form_version_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw cycleError;
  if (!cycle) throw new Error("Diagnóstico FAMI não encontrado para calcular metadados.");

  const processingId = await resolveCycleProcessingIdForCycle(
    client,
    cycleId,
    processingVersion,
  );
  if (!processingId) {
    throw new Error("Processamento FAMI não encontrado para calcular metadados.");
  }

  const meta = await loadProcessingFamiQuestionMeta(client, {
    formVersionId: cycle.form_version_id as string,
    cycleProcessingId: processingId,
  });
  return {
    applicable: meta.applicableQuestions,
    waived: meta.waivedQuestions,
    notApplicableResponses: meta.notApplicableResponses,
  };
}

/** Builder único de leitura FAMI. */
export async function buildFamiMaturityView(
  scope: FamiScope,
): Promise<FamiMaturityView | null> {
  const resolved = await resolveFamiContextForScope(scope);
  if (!resolved) return null;

  const client = createSupabaseServiceRoleClient();
  const [formContext, processing, global, axes, meta] = await Promise.all([
    loadFamiCycleContext(resolved.cycleId),
    resolveCycleProcessingMetadataForCycle(client, resolved.cycleId, resolved.processingVersion),
    loadFamiGlobalForCycleVersion(resolved.cycleId, resolved.processingVersion),
    loadAxisMaturityForCycleVersion(resolved.cycleId, resolved.processingVersion),
    countMetaQuestions(resolved.cycleId, resolved.processingVersion),
  ]);
  if (!formContext || !processing || processing.status !== "completed" || !global) return null;

  return {
    scope,
    cycleId: resolved.cycleId,
    formId: formContext.formId,
    formName: formContext.formName,
    formVersion: formContext.formVersion,
    cycleState: formContext.cycleState,
    organizationId: formContext.organizationId,
    processingVersion: resolved.processingVersion,
    policyVersion: processing.policyVersion,
    referenceYear: global.createdAt ? getCalendarYearBrt(global.createdAt) : new Date().getFullYear(),
    global: {
      percentage: global.percentage,
      maturityLevel: global.maturityLevel,
      pointsObtained: global.pointsObtained,
      pointsPossible: global.pointsPossible,
    },
    axes,
    meta: {
      applicableQuestions: meta.applicable,
      waivedQuestions: meta.waived,
      notApplicableResponses: meta.notApplicableResponses,
      isOfficialScore: true,
      calculatedAt: global.createdAt,
      closedAt: processing.completedAt,
      responseDeadlineAt: formContext.responseDeadlineAt,
    },
  };
}
