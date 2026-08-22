import { buildHeaders } from "@/infrastructure/api/fetch-client";
import type { RecommendationException } from "./exceptions-types";

export type { RecommendationException } from "./exceptions-types";

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Falha ao processar a exceção.");
  }
  return body as Record<string, unknown>;
}

export async function listRecommendationExceptions(
  role: "admin" | "respondent",
  organizationId: string,
): Promise<RecommendationException[]> {
  const endpoint = role === "admin"
    ? `/api/admin/library/exceptions?organizationId=${encodeURIComponent(organizationId)}`
    : "/api/respondent/library/exceptions";
  const body = await parseResponse(await fetch(endpoint));
  return Array.isArray(body.exceptions) ? body.exceptions as RecommendationException[] : [];
}

export async function requestRecommendationException(input: {
  organizationId: string;
  recommendationId: string;
  questionId: string;
  motivo: string;
  prazo?: string | null;
}): Promise<RecommendationException> {
  const body = await parseResponse(await fetch("/api/respondent/library/exceptions", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(input),
  }));
  if (!body.exception) throw new Error("A API não retornou a exceção criada.");
  return body.exception as RecommendationException;
}

export async function decideRecommendationException(
  id: string,
  status: "approved" | "rejected",
): Promise<RecommendationException> {
  const body = await parseResponse(await fetch(`/api/admin/library/exceptions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: buildHeaders(),
    body: JSON.stringify({ status }),
  }));
  if (!body.exception) throw new Error("A API não retornou a decisão registrada.");
  return body.exception as RecommendationException;
}
