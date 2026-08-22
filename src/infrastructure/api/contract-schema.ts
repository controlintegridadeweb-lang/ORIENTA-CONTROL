import { z, type ZodType } from "zod";

export type RuntimeFieldRule =
  | "string"
  | "optional-string"
  | "nullable-string"
  | "number"
  | "nullable-number"
  | "optional-number"
  | "boolean"
  | "optional-boolean"
  | "array"
  | "optional-array"
  | "object"
  | "nullable-object"
  | "optional-object";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesRule(value: unknown, rule: RuntimeFieldRule): boolean {
  switch (rule) {
    case "string":
      return typeof value === "string";
    case "optional-string":
      return value === undefined || typeof value === "string";
    case "nullable-string":
      return value === null || typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "nullable-number":
      return value === null || (typeof value === "number" && Number.isFinite(value));
    case "optional-number":
      return value === undefined || (typeof value === "number" && Number.isFinite(value));
    case "boolean":
      return typeof value === "boolean";
    case "optional-boolean":
      return value === undefined || typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "optional-array":
      return value === undefined || Array.isArray(value);
    case "object":
      return isRecord(value);
    case "nullable-object":
      return value === null || isRecord(value);
    case "optional-object":
      return value === undefined || isRecord(value);
  }
}

/**
 * Cria um contrato Zod para DTOs extensos sem confiar em coerção de tipo.
 * Cada campo declarado é verificado em runtime; campos adicionais permanecem
 * permitidos para que a API possa evoluir de forma aditiva.
 */
export function objectContract<T extends object>(
  name: string,
  fields: Readonly<Record<string, RuntimeFieldRule>>,
): ZodType<T> {
  return z.custom<T>(
    (value): value is T =>
      isRecord(value) &&
      Object.entries(fields).every(([field, rule]) => matchesRule(value[field], rule)),
    { error: `Contrato inválido: ${name}.` },
  );
}

export const unknownRecordSchema = z.record(z.string(), z.unknown());
