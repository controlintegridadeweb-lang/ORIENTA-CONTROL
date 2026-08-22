/** Estrutura mínima compartilhada pelos erros do PostgreSQL, PostgREST e Supabase. */
export type DatabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function asDatabaseError(error: unknown): DatabaseErrorLike | null {
  return typeof error === "object" && error !== null
    ? (error as DatabaseErrorLike)
    : null;
}

export function databaseErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  const candidate = asDatabaseError(error);
  return candidate ? String(candidate.message ?? "") : "";
}

export function databaseErrorSqlState(error: unknown): string | null {
  const candidate = asDatabaseError(error);
  const code = candidate?.code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reconhece um código de domínio emitido pelo PostgreSQL como token completo.
 * Evita comparações espalhadas por trechos livres de mensagem e falsos positivos
 * por prefixo/sufixo. O SQLSTATE continua disponível por `databaseErrorSqlState`.
 */
export function hasDatabaseErrorCode(error: unknown, expectedCode: string): boolean {
  const candidate = asDatabaseError(error);
  if (candidate?.code === expectedCode) return true;

  const message = databaseErrorMessage(error);
  if (!message) return false;
  const token = new RegExp(
    `(?:^|[^A-Za-z0-9_])${escapeRegExp(expectedCode)}(?:$|[^A-Za-z0-9_])`,
  );
  return token.test(message);
}

export function hasAnyDatabaseErrorCode(
  error: unknown,
  expectedCodes: readonly string[],
): boolean {
  return expectedCodes.some((code) => hasDatabaseErrorCode(error, code));
}

export function isUniqueViolation(error: unknown): boolean {
  return databaseErrorSqlState(error) === "23505";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return databaseErrorSqlState(error) === "23503";
}
