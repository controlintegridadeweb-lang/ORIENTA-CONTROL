import "server-only";

import type { Json } from "@/infrastructure/supabase/database.types";
import {
  createSupabaseServiceRoleClient,
  type TypedSupabaseClient,
} from "@/infrastructure/supabase/server";
import { DomainNotFoundError } from "@/infrastructure/api/domain-errors";
import { questionLibraryConfigurationInputSchema } from "./binding-schemas";
import type {
  InlineMetric,
  QuestionLibraryConfiguration,
} from "./binding-types";
import { computeCoverageScore, validateConfigurationForPublish } from "./binding-validation";
import { normalizeBindings } from "./normalize-bindings";
import { LibraryValidationError } from "./errors";

function normalizeMetric(raw: Json | null | undefined): InlineMetric | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, Json | undefined>;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || value.answerType !== "yes_no" || value.interpretation !== "qualitative") {
    return null;
  }
  return {
    name,
    description: typeof value.description === "string" ? value.description : null,
    answerType: "yes_no",
    interpretation: "qualitative",
  };
}

function toConfiguration(input: {
  questionId: string;
  sectionId: string;
  binding?: {
    metric: Json;
    bindings: Json;
    response_mapping: Json;
    coverage_score: number;
    updated_by: string | null;
    updated_at: string;
  } | null;
}): QuestionLibraryConfiguration | null {
  if (!input.binding) return null;
  return {
    questionId: input.questionId,
    sectionId: input.sectionId,
    metric: normalizeMetric(input.binding.metric),
    bindings: normalizeBindings(input.binding.bindings),
    responseMapping: {},
    coverageScore: Number(input.binding.coverage_score ?? 0),
    updatedBy: input.binding.updated_by,
    updatedAt: input.binding.updated_at,
  };
}

export class QuestionBindingService {
  constructor(
    private readonly client: TypedSupabaseClient = createSupabaseServiceRoleClient(),
  ) {}

  private async requireDraftQuestion(formId: string, questionId: string) {
    const { data: draft, error: draftError } = await this.client
      .from("form_drafts")
      .select("id")
      .eq("form_id", formId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) throw new DomainNotFoundError("Rascunho do formulário não encontrado.");

    const { data: linked, error: linkedError } = await this.client
      .from("form_draft_questions")
      .select("question_id")
      .eq("form_draft_id", draft.id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (linkedError) throw linkedError;
    if (!linked) {
      throw new DomainNotFoundError("Pergunta não encontrada no rascunho do formulário.");
    }

    const { data: question, error: questionError } = await this.client
      .from("questions")
      .select("id,prompt,section_id")
      .eq("id", questionId)
      .maybeSingle();
    if (questionError) throw questionError;
    if (!question) throw new DomainNotFoundError("Pergunta não encontrada.");
    return question;
  }

  async getConfiguration(
    formId: string,
    questionId: string,
  ): Promise<QuestionLibraryConfiguration | null> {
    const question = await this.requireDraftQuestion(formId, questionId);
    const { data: binding, error } = await this.client
      .from("question_library_binding")
      .select("metric,bindings,response_mapping,coverage_score,updated_by,updated_at")
      .eq("question_id", questionId)
      .maybeSingle();
    if (error) throw error;
    return toConfiguration({
      questionId,
      sectionId: question.section_id,
      binding,
    });
  }

  async saveConfiguration(
    formId: string,
    questionId: string,
    payload: unknown,
    actor: { userId: string },
  ): Promise<QuestionLibraryConfiguration> {
    const parsed = questionLibraryConfigurationInputSchema.safeParse(payload);
    if (!parsed.success) {
      throw new LibraryValidationError(
        parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
          path: issue.path.join(".") || "_",
          message: issue.message,
        })),
      );
    }

    const question = await this.requireDraftQuestion(formId, questionId);
    const bindings = normalizeBindings(parsed.data.bindings);
    const coverageScore = computeCoverageScore(bindings);
    const metric: InlineMetric = {
      name: question.prompt.slice(0, 200) || "Pergunta",
      description: null,
      answerType: "yes_no",
      interpretation: "qualitative",
    };

    const recommendation = bindings.defaultRecommendation ?? null;
    const { error } = await this.client.rpc("save_question_library_configuration", {
      p_form_id: formId,
      p_question_id: questionId,
      p_section_id: parsed.data.sectionId,
      p_metric: {
        name: metric.name,
        description: metric.description ?? null,
        answerType: "yes_no",
        interpretation: "qualitative",
      },
      p_bindings: {
        defaultRecommendation: recommendation
          ? {
              title: recommendation.title,
              description: recommendation.description ?? null,
              textoBaseFixo: recommendation.textoBaseFixo ?? null,
              textoBaseParametrizavel: recommendation.textoBaseParametrizavel ?? null,
              tipo: recommendation.tipo ?? null,
              fundamentoTecnico: recommendation.fundamentoTecnico ?? null,
              escopoAplicacao: recommendation.escopoAplicacao ?? null,
            }
          : null,
        note: bindings.note ?? null,
      },
      p_response_mapping: {},
      p_coverage_score: coverageScore,
      p_actor_user_id: actor.userId,
    });
    if (error) throw error;

    const saved = await this.getConfiguration(formId, questionId);
    if (!saved) {
      throw new Error("A configuração foi persistida, mas não pôde ser recarregada.");
    }
    return saved;
  }

  async listMissingForForm(
    formId: string,
  ): Promise<Array<{ questionId: string; missing: string[] }>> {
    const { data: draft, error: draftError } = await this.client
      .from("form_drafts")
      .select("id")
      .eq("form_id", formId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) return [];

    const { data: links, error: linksError } = await this.client
      .from("form_draft_questions")
      .select("question_id")
      .eq("form_draft_id", draft.id)
      .order("order_index", { ascending: true });
    if (linksError) throw linksError;
    const linkRows = (links ?? []) as Array<{ question_id: string }>;
    const questionIds = linkRows.map((row) => row.question_id);
    if (questionIds.length === 0) return [];

    const [{ data: questions, error: questionError }, { data: bindings, error: bindingError }] =
      await Promise.all([
        this.client
          .from("questions")
          .select("id,section_id")
          .in("id", questionIds),
        this.client
          .from("question_library_binding")
          .select("question_id,metric,bindings,response_mapping,coverage_score,updated_by,updated_at")
          .in("question_id", questionIds),
      ]);
    if (questionError) throw questionError;
    if (bindingError) throw bindingError;

    const questionRows = (questions ?? []) as Array<{ id: string; section_id: string }>;
    const bindingRows = (bindings ?? []) as Array<{
      question_id: string;
      metric: Json;
      bindings: Json;
      response_mapping: Json;
      coverage_score: number;
      updated_by: string | null;
      updated_at: string;
    }>;
    const questionsById = new Map(questionRows.map((row) => [row.id, row]));
    const bindingsByQuestionId = new Map(bindingRows.map((row) => [row.question_id, row]));
    const pending: Array<{ questionId: string; missing: string[] }> = [];

    for (const questionId of questionIds) {
      const question = questionsById.get(questionId);
      if (!question) {
        pending.push({ questionId, missing: ["question"] });
        continue;
      }
      const configuration = toConfiguration({
        questionId,
        sectionId: question.section_id,
        binding: bindingsByQuestionId.get(questionId) ?? null,
      });
      if (!configuration) {
        pending.push({ questionId, missing: ["defaultRecommendation", "metric"] });
        continue;
      }
      const validation = validateConfigurationForPublish(configuration);
      if (!validation.valid) pending.push({ questionId, missing: validation.missing });
    }

    return pending;
  }
}
