import { apiErrorSchema, parseJson } from "@/infrastructure/api/fetch-client";

/** Lê a mensagem do contrato de erro HTTP sem duplicar parsing nos handlers. */
export async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await parseJson(response, apiErrorSchema);
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}
