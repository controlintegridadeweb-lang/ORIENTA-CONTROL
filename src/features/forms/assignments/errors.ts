import {
  DomainAccessError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";

// Marcadores semanticos finos sobre as classes genericas de
// @/infrastructure/api/domain-errors; o mapeamento para HTTP (400/404/403) vive em
// handleDomainError.

export class FormAssignmentsValidationError extends DomainValidationError {
  constructor(issues: { path: string; message: string }[]) {
    super(issues, "Dados inválidos para atribuição de formulário.");
    this.name = "FormAssignmentsValidationError";
  }
}

export class FormAssignmentsNotFoundError extends DomainNotFoundError {
  constructor(message = "Atribuição não encontrada.") {
    super(message);
    this.name = "FormAssignmentsNotFoundError";
  }
}

export class FormAssignmentAccessError extends DomainAccessError {
  constructor(message = "Organização não incluída neste formulário.") {
    super(message);
    this.name = "FormAssignmentAccessError";
  }
}
