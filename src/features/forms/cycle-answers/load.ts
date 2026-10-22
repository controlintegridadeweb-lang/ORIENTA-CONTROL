import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getRespondentDetail } from "../respondent-detail";
import {
  mapCycleAnswerRow,
  type CycleAnswersSpreadsheet,
  type QuestionLocation,
} from "./spreadsheet";

const locationRowSchema = z.object({
  question_versions: z.object({
    question_id: z.string().min(1),
    axis_name: z.string(),
    section_name: z.string(),
  }),
});

async function loadQuestionLocations(
  client: SupabaseClient,
  formVersionId: string,
): Promise<Map<string, QuestionLocation>> {
  const { data, error } = await client
    .from("form_questions")
    .select("question_versions!inner(question_id, axis_name, section_name)")
    .eq("form_version_id", formVersionId);
  if (error) throw error;

  const locations = new Map<string, QuestionLocation>();
  for (const row of z.array(locationRowSchema).parse(data ?? [])) {
    locations.set(row.question_versions.question_id, {
      axisName: row.question_versions.axis_name,
      sectionName: row.question_versions.section_name,
    });
  }
  return locations;
}

export async function loadCycleAnswersExport(
  client: SupabaseClient,
  input: { cycleId: string; formVersionId: string; formName: string },
): Promise<CycleAnswersSpreadsheet> {
  const [detail, locations] = await Promise.all([
    getRespondentDetail(client, input.cycleId),
    loadQuestionLocations(client, input.formVersionId),
  ]);

  return {
    formName: input.formName,
    organizationName: detail.organizationName,
    periodLabel: detail.periodLabel,
    rows: detail.answers.map((answer) =>
      mapCycleAnswerRow(answer, locations.get(answer.questionId) ?? null),
    ),
  };
}
