import { z } from "zod";
import {
  apiResponseSchema,
  buildHeaders,
  formatError,
  parseJson,
} from "@/infrastructure/api/fetch-client";

const questionWaiverRowSchema = z.object({
  organizationId: z.string().uuid(),
  questionId: z.string().uuid(),
  reason: z.string().nullable(),
  waivedBy: z.string().uuid(),
  waivedAt: z.string(),
}).passthrough();

const questionWaiverListResponseSchema = apiResponseSchema({
  waivers: z.array(questionWaiverRowSchema).optional(),
});

const questionWaiverReplacementResponseSchema = apiResponseSchema({
  ok: z.boolean().optional(),
});

export type QuestionWaiverRow = z.infer<typeof questionWaiverRowSchema>;

export async function listQuestionWaiversForOrganizations(
  organizationIds: string[],
): Promise<QuestionWaiverRow[]> {
  const uniqueIds = [...new Set(organizationIds)];
  if (uniqueIds.length === 0) return [];

  const response = await fetch("/api/admin/question-waivers", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ organizationIds: uniqueIds }),
  });
  const body = await parseJson(response, questionWaiverListResponseSchema);
  if (!response.ok) throw new Error(formatError(body));
  return body.waivers ?? [];
}

export async function replaceQuestionWaivers(input: {
  questionId: string;
  scopeOrganizationIds: string[];
  waivers: Array<{ organizationId: string; reason: string | null }>;
}): Promise<void> {
  const response = await fetch("/api/admin/question-waivers", {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(input),
  });
  const body = await parseJson(response, questionWaiverReplacementResponseSchema);
  if (!response.ok) throw new Error(formatError(body));
  if (body.ok !== true) {
    throw new Error("O servidor não confirmou a atualização da aplicabilidade.");
  }
}
