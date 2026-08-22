import {
  DomainConflictError,
  DomainUnavailableError,
  DomainValidationError,
} from "./domain-errors";

/**
 * Traduz erros conhecidos de operações administrativas para uma mensagem que
 * pode ser exibida ao usuário sem vazar detalhes técnicos.
 */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainValidationError) {
    return error.issues[0]?.message ?? error.message;
  }
  if (error instanceof DomainConflictError) {
    return error.message;
  }
  if (error instanceof DomainUnavailableError) {
    return error.message;
  }
  return fallback;
}
