import { z } from "zod";
import { apiResponseSchema, parseJson } from "@/infrastructure/api/fetch-client";
import type { RespondentProgress } from "./contracts";

const respondentProgressSchema = z.object({
  cycleId: z.string(),
  formId: z.string(),
  formName: z.string(),
  periodLabel: z.string(),
  formVersion: z.number(),
  organizationName: z.string(),
  state: z.string(),
  totalQuestions: z.number(),
  answeredQuestions: z.number(),
  submissionReady: z.boolean(),
  submissionBlockCount: z.number(),
  complementationRequests: z.number(),
  resolvedComplementationRequests: z.number(),
});

const respondentFormsProgressSchema = apiResponseSchema({
  items: z.array(respondentProgressSchema),
  year: z.number().int(),
});

export type RespondentFormsProgressResponse = {
  items: RespondentProgress[];
  year: number;
};

export async function fetchRespondentFormsProgress(
  year: number,
): Promise<RespondentFormsProgressResponse> {
  const params = new URLSearchParams({ year: String(year) });
  const response = await fetch(`/api/respondent/dashboard/forms-progress?${params}`, {
    cache: "no-store",
  });
  const body = await parseJson(response, respondentFormsProgressSchema);
  if (!response.ok || !Array.isArray(body.items)) {
    throw new Error(body.error ?? "Falha ao carregar formulários.");
  }
  return { items: body.items, year: body.year };
}
