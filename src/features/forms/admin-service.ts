import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import {
  FormsConflictError,
  FormsNotFoundError,
  FormsValidationError,
  type FormSummary,
  type QuestionRow,
} from "./admin-domain";
import { FormsAdminFormService } from "./admin-form-service";
import { FormsAdminQuestionService } from "./admin-question-service";
import { FormsAdminRepository } from "./admin-repository";

export {
  FormsConflictError,
  FormsNotFoundError,
  FormsValidationError,
  type FormSummary,
  type QuestionRow,
};

/**
 * Fachada administrativa de formulários.
 *
 * Mantém o contrato público estável e delega formulários, critérios e acesso a
 * dados para serviços com responsabilidades distintas.
 */
export class FormsAdminService {
  private readonly forms: FormsAdminFormService;
  private readonly questions: FormsAdminQuestionService;

  constructor(client?: TypedSupabaseClient) {
    const repository = new FormsAdminRepository(
      client ?? createSupabaseServiceRoleClient(),
    );
    this.forms = new FormsAdminFormService(repository);
    this.questions = new FormsAdminQuestionService(repository);
  }

  list(): Promise<FormSummary[]> {
    return this.forms.list();
  }

  listPage(input?: Parameters<FormsAdminFormService["listPage"]>[0]) {
    return this.forms.listPage(input);
  }

  getById(formId: string): Promise<FormSummary> {
    return this.forms.getById(formId);
  }

  create(input: unknown, actor: { userId: string }): Promise<FormSummary> {
    return this.forms.create(input, actor);
  }

  rename(formId: string, input: unknown): Promise<FormSummary> {
    return this.forms.rename(formId, input);
  }

  deleteForm(formId: string, actor: { userId: string }): Promise<void> {
    return this.forms.deleteForm(formId, actor);
  }

  listQuestions(formId: string): Promise<QuestionRow[]> {
    return this.questions.listQuestions(formId);
  }

  createQuestion(
    formId: string,
    input: unknown,
    actor: { userId: string },
  ): Promise<QuestionRow> {
    return this.questions.createQuestion(formId, input, actor);
  }

  updateQuestion(
    formId: string,
    questionId: string,
    input: unknown,
  ): Promise<QuestionRow> {
    return this.questions.updateQuestion(formId, questionId, input);
  }

  removeQuestion(
    formId: string,
    questionId: string,
    actor: { userId: string },
  ): Promise<void> {
    return this.questions.removeQuestion(formId, questionId, actor);
  }

  reorderQuestions(formId: string, input: unknown): Promise<QuestionRow[]> {
    return this.questions.reorderQuestions(formId, input);
  }
}
