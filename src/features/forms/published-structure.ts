import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { normalizeBindings } from "@/features/library";
import type { PublishedFormQuestion, PublishedFormStructure } from "./published-structure-types";

export type { PublishedFormQuestion, PublishedFormStructure } from "./published-structure-types";

const joinedQuestionSchema = z.object({
  question_id: z.string().uuid(),
  version: z.number().int().positive(),
  prompt: z.string(),
  evidence_parameter: z.unknown(),
  fami_enabled: z.boolean(),
  applies_to_respondent: z.boolean(),
  section_id: z.string().uuid(),
  section_name: z.string(),
  section_order: z.number().int(),
  axis_id: z.string().uuid(),
  axis_name: z.string(),
  library_binding_snapshot: z.unknown(),
});

const formQuestionSchema = z.object({
  order_index: z.number().int(),
  question_versions: joinedQuestionSchema,
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadPublishedFormStructure(
  formVersionId: string,
): Promise<PublishedFormStructure | null> {
  const supabase = createSupabaseServiceRoleClient();
  const [{ data: version, error: versionError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase
        .from("form_versions")
        .select("id, version, published_at")
        .eq("id", formVersionId)
        .maybeSingle(),
      supabase
        .from("form_questions")
        .select(
          "order_index, question_versions!inner(question_id, version, prompt, evidence_parameter, fami_enabled, applies_to_respondent, section_id, section_name, section_order, axis_id, axis_name, library_binding_snapshot)",
        )
        .eq("form_version_id", formVersionId)
        .order("order_index", { ascending: true }),
    ]);

  if (versionError) throw versionError;
  if (rowsError) throw rowsError;
  if (!version) return null;

  const questions = z.array(formQuestionSchema).parse(rows ?? []).map((row) => {
    const question = row.question_versions;
    const evidenceParameter = record(question.evidence_parameter);
    const snapshot = record(question.library_binding_snapshot);
    const metric = record(snapshot.metric);
    const bindings = normalizeBindings(snapshot.bindings);
    return {
      questionId: question.question_id,
      questionVersion: question.version,
      orderIndex: row.order_index,
      prompt: question.prompt,
      evidenceRequired: evidenceParameter.required === true,
      famiEnabled: question.fami_enabled,
      appliesToRespondent: question.applies_to_respondent,
      sectionId: question.section_id,
      sectionName: question.section_name,
      sectionOrder: question.section_order,
      axisId: question.axis_id,
      axisName: question.axis_name,
      metricName: stringOrNull(metric.name),
      metricDescription: stringOrNull(metric.description),
      recommendation: bindings.defaultRecommendation ?? null,
      bindingNote: bindings.note ?? null,
      coverageScore: numberOrNull(snapshot.coverageScore),
    } satisfies PublishedFormQuestion;
  });

  return {
    formVersionId: version.id,
    version: version.version,
    publishedAt: version.published_at ?? null,
    questions,
  };
}

export async function loadCurrentPublishedFormStructure(
  formId: string,
): Promise<PublishedFormStructure | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("forms")
    .select("current_form_version_id")
    .eq("id", formId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.current_form_version_id) return null;
  return loadPublishedFormStructure(data.current_form_version_id);
}

