/** Leitura segura de campos em joins retornados pelo Supabase. */
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRecordField(value: unknown, field: string): unknown {
  return isRecord(value) ? value[field] : undefined;
}
