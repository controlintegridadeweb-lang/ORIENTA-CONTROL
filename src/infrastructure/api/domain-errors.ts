import { NextResponse } from "next/server";

const DEFAULT_INTERNAL_ERROR_MESSAGE =
  "Não foi possível concluir a operação. Tente novamente.";

export function internalServerErrorResponse(
  message = DEFAULT_INTERNAL_ERROR_MESSAGE,
): NextResponse {
  return NextResponse.json(
    { error: message, errorId: crypto.randomUUID() },
    { status: 500 },
  );
}

// ---------------------------------------------------------------------------
// Classes de erro genéricas por domínio
// ---------------------------------------------------------------------------

/**
 * Erro de validação (HTTP 400). Substitui FormsValidationError,
 * EvidencesValidationError, RecommendationsValidationError, etc.
 */
export class DomainValidationError extends Error {
  issues: { path: string; message: string }[];
  constructor(
    issues: { path: string; message: string }[],
    message = "Dados inválidos.",
  ) {
    super(message);
    this.name = "DomainValidationError";
    this.issues = issues;
  }
}

/** Recurso não encontrado (HTTP 404). */
export class DomainNotFoundError extends Error {
  constructor(message = "Registro não encontrado.") {
    super(message);
    this.name = "DomainNotFoundError";
  }
}

/** Conflito de estado (HTTP 409). */
export class DomainConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainConflictError";
  }
}

/** Acesso negado / fora de escopo (HTTP 403). */
export class DomainAccessError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "DomainAccessError";
  }
}

/** Funcionalidade não implementada (HTTP 501). */
export class DomainUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainUnavailableError";
  }
}

/** PostgREST: tabela ou RPC ausente no schema cache (migrations não aplicadas). */
export function isMissingSchemaCacheError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "");
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    (message.includes("schema cache") &&
      (message.includes("Could not find the function") ||
        message.includes("Could not find the table")))
  );
}

const MISSING_RPC_USER_MESSAGE =
  "Este recurso está temporariamente indisponível. Tente novamente ou contate a equipe responsável.";

// ---------------------------------------------------------------------------
// Handler unificado — substitui os 6 arquivos http.ts de domínio
// ---------------------------------------------------------------------------

/**
 * Converte qualquer erro de domínio em NextResponse JSON.
 * Aceita um array de classes de erro adicionais para verificar antes do
 * fallback genérico (útil para erros específicos de domínio como
 * FormPublishPendingError).
 */
export function handleDomainError(
  error: unknown,
  extraHandlers?: Array<(e: unknown) => NextResponse | null>,
  internalErrorMessage?: string,
): NextResponse {
  // Handlers específicos de domínio (passados pelo chamador)
  if (extraHandlers) {
    for (const handler of extraHandlers) {
      const result = handler(error);
      if (result) return result;
    }
  }

  if (error instanceof DomainValidationError) {
    return NextResponse.json(
      { error: error.message, issues: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof DomainNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof DomainConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof DomainAccessError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof DomainUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 501 });
  }
  if (isMissingSchemaCacheError(error)) {
    return NextResponse.json({ error: MISSING_RPC_USER_MESSAGE }, { status: 503 });
  }

  return internalServerErrorResponse(internalErrorMessage);
}
