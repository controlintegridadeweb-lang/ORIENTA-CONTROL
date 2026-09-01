/** Leitura segura de campos em joins retornados pelo Supabase. */
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRecordField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}

/** Lê `error` de um JSON de API sem assumir o contrato de sucesso. */
export function readApiErrorMessage(raw: unknown, fallback: string): string {
  const error = readRecordField(raw, "error");
  return typeof error === "string" && error.trim() ? error.trim() : fallback;
}
