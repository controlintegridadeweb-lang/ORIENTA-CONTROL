import { z } from "zod";
import { apiErrorSchema, apiResponseSchema, buildHeaders, formatError, parseJson } from "@/infrastructure/api/fetch-client";
import { objectContract } from "@/infrastructure/api/contract-schema";
import type {
  LibraryCatalogEntity,
  LibraryCatalogItem,
  LibraryCatalogSnapshot,
  LibraryAxis,
  LibrarySection,
  LibraryRecommendationBase,
} from "./types";
import type { QuestionLibraryConfiguration } from "./binding-types";


const libraryAxisContract = objectContract<LibraryAxis>("eixo da biblioteca", {
  id: "string", code: "string", name: "string", status: "string", ordem: "number", tags: "array",
});
const librarySectionContract = objectContract<LibrarySection>("seção da biblioteca", {
  id: "string", axisId: "string", axisCode: "string", code: "string", name: "string", status: "string", ordem: "number", tags: "array",
});
const libraryRecommendationContract = objectContract<LibraryRecommendationBase>("recomendação da biblioteca", {
  id: "string", code: "string", title: "string", tipo: "string", status: "string", tags: "array", variaveisParametro: "array",
});
const libraryItemContract = z.union([libraryAxisContract, librarySectionContract, libraryRecommendationContract]);
const catalogSchema = apiResponseSchema({
  axes: z.array(libraryAxisContract),
  sections: z.array(librarySectionContract),
  recommendations: z.array(libraryRecommendationContract),
});
const itemResponseSchema = apiResponseSchema({ item: libraryItemContract.optional() });
const questionConfigurationContract = objectContract<QuestionLibraryConfiguration>("configuração da pergunta", {
  questionId: "string", sectionId: "string", metric: "nullable-object", bindings: "object", responseMapping: "object", coverageScore: "number",
});
// GET devolve `null` quando a pergunta ainda não tem linha em
// question_library_binding; `.optional()` sozinho rejeita JSON null.
const configurationResponseSchema = apiResponseSchema({
  configuration: questionConfigurationContract.nullable().optional(),
});
export async function fetchLibraryCatalog(): Promise<LibraryCatalogSnapshot> {
  const response = await fetch("/api/admin/library/catalog", {
    headers: buildHeaders(),
  });
  const body = await parseJson(response, catalogSchema);
  if (
    !response.ok ||
    !Array.isArray(body.axes) ||
    !Array.isArray(body.sections) ||
    !Array.isArray(body.recommendations)
  ) {
    throw new Error(formatError(body));
  }
  return body;
}


export async function createLibraryItem(
  entity: LibraryCatalogEntity,
  payload: Record<string, unknown>,
): Promise<LibraryCatalogItem> {
  const response = await fetch(`/api/admin/library/${entity}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response, itemResponseSchema);
  if (!response.ok || !body.item) throw new Error(formatError(body));
  return body.item;
}

export async function updateLibraryItem(
  entity: LibraryCatalogEntity,
  id: string,
  payload: Record<string, unknown>,
): Promise<LibraryCatalogItem> {
  const response = await fetch(`/api/admin/library/${entity}/${id}`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response, itemResponseSchema);
  if (!response.ok || !body.item) throw new Error(formatError(body));
  return body.item;
}

export async function deleteLibraryItem(entity: LibraryCatalogEntity, id: string): Promise<void> {
  const response = await fetch(`/api/admin/library/${entity}/${id}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  if (!response.ok) {
    const body = await parseJson(response, apiErrorSchema);
    throw new Error(formatError(body));
  }
}

export type LibraryTransition =
  | "submit_for_review"
  | "return_review"
  | "publish"
  | "deprecate"
  | "archive";

export async function transitionLibraryItem(
  entity: LibraryCatalogEntity,
  id: string,
  action: LibraryTransition,
  payload: { justification?: string | null; reviewerUserId?: string | null } = {},
): Promise<LibraryCatalogItem> {
  const response = await fetch(`/api/admin/library/${entity}/${id}/transitions`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await parseJson(response, itemResponseSchema);
  if (!response.ok || !body.item) throw new Error(formatError(body));
  return body.item;
}

export async function fetchQuestionConfiguration(
  formId: string,
  questionId: string,
): Promise<QuestionLibraryConfiguration | null> {
  const response = await fetch(
    `/api/admin/forms/${formId}/questions/${questionId}/binding`,
    { headers: buildHeaders({ Accept: "application/json" }) },
  );
  const body = await parseJson(response, configurationResponseSchema);
  if (!response.ok) throw new Error(formatError(body));
  return body.configuration ?? null;
}

export async function saveQuestionConfiguration(
  formId: string,
  questionId: string,
  payload: Record<string, unknown>,
): Promise<QuestionLibraryConfiguration> {
  const response = await fetch(
    `/api/admin/forms/${formId}/questions/${questionId}/binding`,
    {
      method: "PUT",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    },
  );
  const body = await parseJson(response, configurationResponseSchema);
  if (!response.ok || !body.configuration) throw new Error(formatError(body));
  return body.configuration;
}
