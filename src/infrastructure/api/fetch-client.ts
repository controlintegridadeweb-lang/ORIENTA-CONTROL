import { z, type ZodType } from "zod";

export const apiIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  error: z.string().optional(),
  issues: z.array(apiIssueSchema).optional(),
}).passthrough();

export type ApiError = z.infer<typeof apiErrorSchema>;

export function apiResponseSchema<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object({
    error: z.string().optional(),
    issues: z.array(apiIssueSchema).optional(),
    ...shape,
  }).passthrough();
}

/**
 * Faz parse e validação do contrato JSON da resposta HTTP.
 *
 * O schema é obrigatório: o cliente não pode declarar, apenas por generic,
 * que um JSON desconhecido possui determinado formato.
 */
export async function parseJson<T>(response: Response, schema: ZodType<T>): Promise<T> {
  const text = (await response.text()).trim();
  if (!text) throw new Error("O servidor retornou uma resposta vazia.");

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const errorPayload = apiErrorSchema.safeParse(value);
    if (errorPayload.success && errorPayload.data.error) {
      throw new Error(formatError(value));
    }
    throw new Error("O servidor retornou dados incompatíveis com o contrato esperado.");
  }
  return parsed.data;
}

export function formatError(payload: unknown, fallback = "Erro desconhecido."): string {
  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) return fallback;
  const errorPayload = parsed.data;
  if (errorPayload.issues && errorPayload.issues.length > 0) {
    return errorPayload.issues
      .map((issue) => `${issue.path === "_" ? "" : `${issue.path}: `}${issue.message}`)
      .join(" | ");
  }
  return errorPayload.error ?? fallback;
}

/** Monta os headers HTTP comuns dos clientes da aplicação. */
export function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}
