import { z } from "zod";

const UUID_PARAM_SCHEMA = z.string().trim().uuid();

/** Retorna o UUID normalizado ou `undefined` quando o parâmetro é ausente/inválido. */
export function parseUuidParam(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parsed = UUID_PARAM_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Valor seguro para estados de filtro controlados por string vazia. */
export function uuidParamOrEmpty(value: string | null | undefined): string {
  return parseUuidParam(value) ?? "";
}

/** Indica que o parâmetro foi informado, mas não representa um UUID válido. */
export function isInvalidUuidParam(value: string | null | undefined): boolean {
  return Boolean(value?.trim()) && parseUuidParam(value) == null;
}
