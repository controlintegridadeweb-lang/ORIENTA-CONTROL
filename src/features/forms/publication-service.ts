import "server-only";

import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import { QuestionBindingService } from "@/features/library/server";
import { FormsAdminService } from "./admin-service";
import { FormAssignmentsService } from "./assignments/service";
import { FormPublishPendingError, type FormPublishReadiness } from "./publish-contract";
import { evaluateFormPublishReadiness } from "./publish-readiness";

export type FormPublishReadinessResult = {
  readiness: FormPublishReadiness;
  form: {
    id: string;
    name: string;
    state: "draft" | "published" | "superseded" | "archived";
    version: number | null;
  };
  questionCount: number;
};

export class FormsPublicationService {
  private readonly forms: FormsAdminService;
  private readonly assignments: FormAssignmentsService;
  private readonly bindings: QuestionBindingService;

  constructor(
    private readonly client: TypedSupabaseClient = createSupabaseServiceRoleClient(),
  ) {
    this.forms = new FormsAdminService(client);
    this.assignments = new FormAssignmentsService();
    this.bindings = new QuestionBindingService(client);
  }

  async readiness(formId: string): Promise<FormPublishReadinessResult> {
    const [form, questions, assignments, bindingPending] = await Promise.all([
      this.forms.getById(formId),
      this.forms.listQuestions(formId),
      this.assignments.getSummary(formId),
      this.bindings.listMissingForForm(formId),
    ]);
    const readiness = evaluateFormPublishReadiness({
      form,
      questionCount: questions.length,
      bindingPending,
      assignmentCount: assignments.organizationIds.length,
    });
    return {
      readiness,
      form: {
        id: form.id,
        name: form.name,
        state: form.state,
        version: form.version,
      },
      questionCount: questions.length,
    };
  }

  async publish(formId: string, actor: { userId: string }) {
    const status = await this.readiness(formId);
    if (!status.readiness.canPublish) {
      if (status.readiness.pending.length > 0) {
        throw new FormPublishPendingError(
          "Complete o vínculo de biblioteca de todas as perguntas antes de publicar.",
          status.readiness.pending,
        );
      }
      if (!status.readiness.checks.hasName) {
        throw new DomainConflictError("Informe o nome do formulário antes de publicar.");
      }
      if (!status.readiness.checks.hasQuestions) {
        throw new DomainConflictError("Adicione ao menos uma pergunta antes de publicar.");
      }
      if (!status.readiness.checks.hasAssignments) {
        throw new DomainConflictError(
          "Vincule o formulário a pelo menos uma organização antes de publicar.",
        );
      }
      throw new DomainConflictError("O formulário ainda não está pronto para publicação.");
    }

    const { error } = await this.client.rpc("publish_form", {
      p_form_id: formId,
      p_actor_user_id: actor.userId,
    });
    if (error) {
      if (hasDatabaseErrorCode(error, "form_publish_requires_assignment")) {
        throw new DomainConflictError(
          "Vincule o formulário a pelo menos uma organização antes de publicar.",
        );
      }
      if (hasDatabaseErrorCode(error, "draft_is_empty")) {
        throw new DomainConflictError("Adicione ao menos uma pergunta antes de publicar.");
      }
      throw error;
    }
    return this.forms.getById(formId);
  }
}
