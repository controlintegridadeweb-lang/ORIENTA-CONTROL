import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { z } from "zod";
import {
  evidenceParameterPayload,
  isEvidenceRequired,
} from "@/shared/domain/evidence-parameter";
import { logInfo } from "@/infrastructure/observability/logger";
import {
  createQuestionSchema,
  reorderSchema,
  updateQuestionSchema,
} from "./schemas";
import {
  FormsNotFoundError,
  FormsValidationError,
  parseFormsInput,
  type QuestionRow,
} from "./admin-domain";
import { FormsAdminRepository } from "./admin-repository";


const createdQuestionRowSchema = z.object({
  id: z.string().min(1),
  section_id: z.string().min(1),
  prompt: z.string(),
  evidence_parameter: z.unknown(),
  allows_not_applicable: z.boolean().optional().default(false),
  order_index: z.number().int().nonnegative(),
});

const QUESTION_SELECT =
  "id, section_id, prompt, evidence_parameter, allows_not_applicable";

export class FormsAdminQuestionService {
  constructor(private readonly repository: FormsAdminRepository) {}

  async listQuestions(formId: string): Promise<QuestionRow[]> {
    await this.repository.loadFormRow(formId);
    const draftId = await this.repository.ensureDraft(formId);
    const { data: links, error: linksError } = await this.repository.client
      .from("form_draft_questions")
      .select("question_id, order_index")
      .eq("form_draft_id", draftId)
      .order("order_index", { ascending: true });
    if (linksError) throw linksError;

    const questionIds = (links ?? []).map((row) => row.question_id);
    if (questionIds.length === 0) return [];

    const { data: questions, error: questionsError } =
      await this.repository.client
        .from("questions")
        .select(QUESTION_SELECT)
        .in("id", questionIds);
    if (questionsError) throw questionsError;

    const questionById = new Map(
      (questions ?? []).map((question) => [question.id, question]),
    );
    return (links ?? []).flatMap((link) => {
      const question = questionById.get(link.question_id);
      if (!question) return [];
      return [this.toQuestionRow(question, link.order_index ?? 0)];
    });
  }

  async createQuestion(
    formId: string,
    input: unknown,
    actor: { userId: string },
  ): Promise<QuestionRow> {
    const value = parseFormsInput(createQuestionSchema, input);
    await this.repository.ensureDraft(formId);
    await this.repository.ensureSectionExists(value.sectionId);

    const evidenceParameter = evidenceParameterPayload(value.requiresEvidence);
    const { data, error } = await this.repository.client.rpc("create_form_draft_question", {
      p_form_id: formId,
      p_section_id: value.sectionId,
      p_prompt: value.prompt,
      p_evidence_parameter: evidenceParameter.evidence_parameter,
      p_actor_user_id: actor.userId,
    });
    if (error) throw error;
    const parsedRow = createdQuestionRowSchema.safeParse(data);
    if (!parsedRow.success) {
      throw new Error("form_question_creation_result_invalid");
    }
    let row = parsedRow.data;

    // O RPC de criação ainda não recebe o flag; persiste após o INSERT.
    if (value.allowsNotApplicable) {
      const { data: updated, error: updateError } =
        await this.repository.client
          .from("questions")
          .update({ allows_not_applicable: true })
          .eq("id", row.id)
          .select(QUESTION_SELECT)
          .single();
      if (updateError) throw updateError;
      row = {
        ...row,
        allows_not_applicable: Boolean(
          (updated as { allows_not_applicable?: boolean }).allows_not_applicable,
        ),
      };
    }

    logInfo("forms.admin.question_created", {
      formId,
      questionId: row.id,
      orderIndex: row.order_index,
      actorUserId: actor.userId,
    });
    return this.toQuestionRow(row, row.order_index);
  }

  async updateQuestion(
    formId: string,
    questionId: string,
    input: unknown,
  ): Promise<QuestionRow> {
    const value = parseFormsInput(updateQuestionSchema, input);
    const draftId = await this.repository.ensureDraft(formId);
    const { data: link, error: linkError } = await this.repository.client
      .from("form_draft_questions")
      .select("order_index")
      .eq("form_draft_id", draftId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      throw new FormsNotFoundError(
        "Pergunta não encontrada neste formulário.",
      );
    }

    const payload: {
      prompt?: string;
      section_id?: string;
      evidence_parameter?: ReturnType<
        typeof evidenceParameterPayload
      >["evidence_parameter"];
      allows_not_applicable?: boolean;
    } = {};
    if (value.prompt !== undefined) payload.prompt = value.prompt;
    if (value.sectionId !== undefined) {
      await this.repository.ensureSectionExists(value.sectionId);
      payload.section_id = value.sectionId;
    }
    if (value.requiresEvidence !== undefined) {
      payload.evidence_parameter = evidenceParameterPayload(
        value.requiresEvidence,
      ).evidence_parameter;
    }
    if (value.allowsNotApplicable !== undefined) {
      payload.allows_not_applicable = value.allowsNotApplicable;
    }

    const { data: question, error: questionError } =
      await this.repository.client
        .from("questions")
        .update(payload)
        .eq("id", questionId)
        .select(QUESTION_SELECT)
        .single();
    if (questionError) throw questionError;
    return this.toQuestionRow(question, link.order_index ?? 0);
  }

  async removeQuestion(
    formId: string,
    questionId: string,
    actor: { userId: string },
  ): Promise<void> {
    const { error } = await this.repository.client.rpc("remove_form_draft_question", {
      p_form_id: formId,
      p_question_id: questionId,
      p_actor_user_id: actor.userId,
    });
    if (error) {
      if (hasDatabaseErrorCode(error, "form_question_not_found")) {
        throw new FormsNotFoundError("Pergunta não encontrada neste formulário.");
      }
      throw error;
    }
    logInfo("forms.admin.question_removed", { formId, questionId, actorUserId: actor.userId });
  }

  async reorderQuestions(
    formId: string,
    input: unknown,
  ): Promise<QuestionRow[]> {
    const value = parseFormsInput(reorderSchema, input);
    const draftId = await this.repository.ensureDraft(formId);
    const current = await this.listQuestions(formId);
    const currentIds = new Set(current.map((question) => question.id));
    const orderedIds = new Set(value.orderedQuestionIds);

    if (
      orderedIds.size !== currentIds.size ||
      value.orderedQuestionIds.length !== currentIds.size
    ) {
      throw new FormsValidationError([
        {
          path: "orderedQuestionIds",
          message:
            "A lista de ordem não corresponde ao conjunto atual de perguntas do formulário.",
        },
      ]);
    }
    for (const questionId of orderedIds) {
      if (!currentIds.has(questionId)) {
        throw new FormsValidationError([
          {
            path: "orderedQuestionIds",
            message: `Pergunta ${questionId} não pertence a este formulário.`,
          },
        ]);
      }
    }

    await this.repository.applyQuestionOrder(draftId, value.orderedQuestionIds);
    return this.listQuestions(formId);
  }

  private toQuestionRow(
    question: {
      id: string;
      section_id: string;
      prompt: string;
      evidence_parameter: unknown;
      allows_not_applicable?: boolean | null;
    },
    orderIndex: number,
  ): QuestionRow {
    return {
      id: question.id,
      sectionId: question.section_id,
      prompt: question.prompt,
      requiresEvidence: isEvidenceRequired({
        evidence_parameter: question.evidence_parameter,
      }),
      allowsNotApplicable: Boolean(question.allows_not_applicable),
      orderIndex,
    };
  }
}
