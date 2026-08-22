import {
  DomainConflictError,
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import type { FormPublicationState } from "./form-publication-state";
import type { ZodType } from "zod";

export class FormsValidationError extends DomainValidationError {
  constructor(issues: { path: string; message: string }[]) {
    super(issues, "Dados inválidos para formulário ou pergunta.");
    this.name = "FormsValidationError";
  }
}

export class FormsConflictError extends DomainConflictError {
  constructor(message: string) {
    super(message);
    this.name = "FormsConflictError";
  }
}

export class FormsNotFoundError extends DomainNotFoundError {
  constructor(message = "Registro não encontrado.") {
    super(message);
    this.name = "FormsNotFoundError";
  }
}

export type FormSummary = {
  id: string;
  name: string;
  version: number | null;
  state: FormPublicationState;
  createdAt: string;
  questionCount: number;
  publishedAt: string | null;
};

export type QuestionRow = {
  id: string;
  prompt: string;
  sectionId: string;
  requiresEvidence: boolean;
  /** Critério elegível à classificação administrativa “Não se aplica”. */
  allowsNotApplicable: boolean;
  orderIndex: number;
};

export type FormRow = {
  id: string;
  name: string;
  current_form_version_id: string | null;
  created_at: string;
  created_by: string;
};

export function parseFormsInput<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "_",
    message: issue.message,
  }));
  throw new FormsValidationError(
    issues.length > 0 ? issues : [{ path: "_", message: "Dados inválidos." }],
  );
}
