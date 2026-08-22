import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";

export type ValidationIssue = { path: string; message: string };

export class LibraryValidationError extends DomainValidationError {
  constructor(issues: ValidationIssue[]) {
    super(issues, "Dados inválidos para a biblioteca geral.");
    this.name = "LibraryValidationError";
  }
}

export class LibraryConflictError extends DomainConflictError {
  constructor(message = "Registro conflita com um existente (código duplicado ou referência inválida).") {
    super(message);
    this.name = "LibraryConflictError";
  }
}

export function flattenLibraryValidationIssues(error: unknown): ValidationIssue[] {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues: unknown }).issues)) {
    return (error as { issues: Array<{ path: (string | number)[]; message: string }> }).issues.map((issue) => ({
      path: issue.path.join(".") || "_",
      message: issue.message,
    }));
  }
  return [{ path: "_", message: "Dados inválidos." }];
}

export function throwLibrarySupabaseError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "Erro inesperado no banco.";
  if (code === "23505") throw new LibraryConflictError("Código já cadastrado para este tipo de item.");
  if (code === "23503") throw new LibraryConflictError("Referência inválida: o eixo selecionado não existe.");
  if (code === "23514") throw new LibraryValidationError([{ path: "_", message: "Valor fora do intervalo permitido." }]);
  throw new Error(message);
}
