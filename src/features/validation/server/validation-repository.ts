import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  ValidationFormPageResult,
  ValidationViewMode,
} from "../contracts";
import {
  formAdminDecisionFilterToParam,
  formAnalysisSituationToParam,
  formAnswerFilterToParam,
  formProofFilterToParam,
  queueSituationFilterToParam,
  type FormAdminDecisionFilter,
  type FormAnalysisSituation,
  type FormAnswerFilter,
  type FormProofFilter,
  type QueueSituationFilter,
} from "../form-view-model";
import {
  clampValidationPage,
  type ValidationPageSize,
} from "../pagination";
import { hydrateValidationCriteria } from "./validation-page-mapper";
import {
  validationFormSummarySchema,
  validationPageRowSchema,
} from "./validation-rpc-schemas";


const queueEvidenceLocationSchema = z.object({
  found: z.boolean(),
  responseId: z.string().uuid().optional(),
  sectionId: z.string().uuid().nullable().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});

const TARGET_LOOKUP_CHUNK_SIZE = 50;

export type LoadValidationFormOptions = {
  mode?: ValidationViewMode;
  queueSituation?: QueueSituationFilter;
  sectionId?: string | null;
  axisId?: string | null;
  answer?: FormAnswerFilter;
  situation?: FormAnalysisSituation;
  decision?: FormAdminDecisionFilter;
  proof?: FormProofFilter;
  search?: string;
  page?: number;
  pageSize?: ValidationPageSize;
  targetEvidenceId?: string | null;
};

export async function loadValidationFormPage(
  supabase: SupabaseClient,
  cycleId: string,
  options: LoadValidationFormOptions = {},
): Promise<ValidationFormPageResult> {
  const mode = options.mode ?? "fila";
  let queueSituation = options.queueSituation ?? "pending";
  let sectionId = options.sectionId ?? null;
  const axisId = options.axisId ?? null;
  const answer = options.answer ?? "all";
  const situation = options.situation ?? "all";
  const decision = options.decision ?? "all";
  const proof = options.proof ?? "all";
  let search = options.search?.trim() ?? "";
  let page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  let targetResponseId: string | null = null;

  if (mode === "fila" && options.targetEvidenceId) {
    const { data, error } = await supabase.rpc(
      "find_validation_queue_page_for_evidence",
      {
        p_cycle_id: cycleId,
        p_evidence_id: options.targetEvidenceId,
        p_section_id: null,
        p_page_size: pageSize,
      },
    );
    if (error) throw error;
    const location = queueEvidenceLocationSchema.parse(data);
    if (location.found && location.responseId) {
      targetResponseId = location.responseId;
      sectionId = location.sectionId ?? null;
      queueSituation = "all";
      search = "";
    }
  }

  const { data: summaryData, error: summaryError } = await supabase.rpc(
    "get_validation_form_summary",
    { p_cycle_id: cycleId },
  );
  if (summaryError) throw summaryError;
  const summary = validationFormSummarySchema.parse(summaryData);

  async function listResponseIds(offset: number, limit = pageSize) {
    const { data, error } = await supabase.rpc("list_validation_form_page", {
      p_cycle_id: cycleId,
      p_mode: mode,
      p_scope: "todos",
      p_section_id: sectionId,
      p_axis_id: axisId,
      p_answer: formAnswerFilterToParam(answer),
      p_situation:
        mode === "fila"
          ? queueSituationFilterToParam(queueSituation)
          : formAnalysisSituationToParam(situation),
      p_decision: formAdminDecisionFilterToParam(decision),
      p_proof: formProofFilterToParam(proof),
      p_search: search || null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = z.array(validationPageRowSchema).parse(data ?? []);
    return {
      responseIds: rows.map((row) => row.response_id),
      totalItems: rows[0]?.total_count ?? 0,
    };
  }

  if (targetResponseId) {
    let offset = 0;
    while (true) {
      const chunk = await listResponseIds(offset, TARGET_LOOKUP_CHUNK_SIZE);
      const relativeIndex = chunk.responseIds.indexOf(targetResponseId);
      if (relativeIndex >= 0) {
        page = Math.floor((offset + relativeIndex) / pageSize) + 1;
        break;
      }
      offset += chunk.responseIds.length;
      if (chunk.responseIds.length === 0 || offset >= chunk.totalItems) break;
    }
  }

  let { responseIds, totalItems } = await listResponseIds(
    (page - 1) * pageSize,
  );
  const safePage = clampValidationPage(page, totalItems, pageSize);
  if (safePage !== page) {
    page = safePage;
    ({ responseIds, totalItems } = await listResponseIds(
      (page - 1) * pageSize,
    ));
  }

  return {
    mode,
    page,
    pageSize,
    totalItems,
    sectionId,
    axisId,
    queueSituation,
    answer,
    situation,
    decision,
    proof,
    search,
    criteria: await hydrateValidationCriteria(
      supabase,
      cycleId,
      responseIds,
    ),
    formSummary: summary.summary,
    formSections: summary.formSections,
  };
}

