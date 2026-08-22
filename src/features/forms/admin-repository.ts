import { deriveFormPublicationState } from "./form-publication-state";
import type { FormPublicationState } from "./form-publication-state";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";
import {
  FormsNotFoundError,
  FormsValidationError,
  type FormRow,
  type FormSummary,
} from "./admin-domain";

export class FormsAdminRepository {
  constructor(readonly client: TypedSupabaseClient) {}

  async loadFormRow(formId: string): Promise<FormRow> {
    const { data, error } = await this.client
      .from("forms")
      .select("id,name,current_form_version_id,created_at,created_by")
      .eq("id", formId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new FormsNotFoundError("Formulário não encontrado.");
    return data as FormRow;
  }

  async ensureSectionExists(sectionId: string): Promise<void> {
    const { data, error } = await this.client
      .from("sections")
      .select("id")
      .eq("id", sectionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new FormsValidationError([
        { path: "sectionId", message: "Seção não encontrada." },
      ]);
    }
  }

  async ensureDraft(formId: string): Promise<string> {
    const { data: existing, error: selectError } = await this.client
      .from("form_drafts")
      .select("id")
      .eq("form_id", formId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing?.id) return existing.id;

    const { data, error } = await this.client
      .from("form_drafts")
      .insert({ form_id: formId })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async countDraftQuestions(formId: string): Promise<number> {
    const { data: draft, error: draftError } = await this.client
      .from("form_drafts")
      .select("id")
      .eq("form_id", formId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft?.id) return 0;

    const { count, error } = await this.client
      .from("form_draft_questions")
      .select("question_id", { count: "exact", head: true })
      .eq("form_draft_id", draft.id);
    if (error) throw error;
    return count ?? 0;
  }

  async listDraftQuestionIds(formId: string): Promise<string[]> {
    const { data: draft, error: draftError } = await this.client
      .from("form_drafts")
      .select("id")
      .eq("form_id", formId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft?.id) return [];

    const { data, error } = await this.client
      .from("form_draft_questions")
      .select("question_id")
      .eq("form_draft_id", draft.id);
    if (error) throw error;
    return (data ?? []).map((row) => row.question_id);
  }

  async maybeHardDeleteQuestion(questionId: string): Promise<void> {
    const { count: draftLinks, error: draftError } = await this.client
      .from("form_draft_questions")
      .select("question_id", { count: "exact", head: true })
      .eq("question_id", questionId);
    if (draftError) throw draftError;
    if ((draftLinks ?? 0) > 0) return;

    const { count: versionLinks, error: versionError } = await this.client
      .from("question_versions")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId);
    if (versionError) throw versionError;
    if ((versionLinks ?? 0) > 0) return;

    const { error } = await this.client
      .from("questions")
      .delete()
      .eq("id", questionId);
    if (error) throw error;
  }

  async compactOrder(draftId: string): Promise<void> {
    const { data, error } = await this.client
      .from("form_draft_questions")
      .select("question_id, order_index")
      .eq("form_draft_id", draftId)
      .order("order_index", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{
      question_id: string;
      order_index: number;
    }>;
    if (rows.every((row, index) => row.order_index === index)) return;
    await this.applyQuestionOrder(
      draftId,
      rows.map((row) => row.question_id),
    );
  }

  async applyQuestionOrder(
    draftId: string,
    orderedQuestionIds: string[],
  ): Promise<void> {
    const { error } = await this.client.rpc("reorder_form_draft_questions", {
      p_form_draft_id: draftId,
      p_ordered_question_ids: orderedQuestionIds,
    });
    if (error) throw error;
  }

  async toSummary(row: FormRow): Promise<FormSummary> {
    const [publication, questionCount] = await Promise.all([
      deriveFormPublicationState(this.client, row),
      this.countDraftQuestions(row.id),
    ]);
    return {
      id: row.id,
      name: row.name,
      version: publication.currentVersion,
      state: publication.state,
      createdAt: row.created_at,
      questionCount,
      publishedAt: publication.publishedAt,
    };
  }

  async toSummaries(rows: FormRow[]): Promise<FormSummary[]> {
    if (rows.length === 0) return [];

    const versionIds = rows
      .map((row) => row.current_form_version_id)
      .filter((id): id is string => Boolean(id));
    const formIds = rows.map((row) => row.id);
    const versionsPromise =
      versionIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : this.client
            .from("form_versions")
            .select("id,version,state,published_at")
            .in("id", versionIds);
    const draftsPromise = this.client
      .from("form_drafts")
      .select("id,form_id")
      .in("form_id", formIds);

    const [versionsResult, draftsResult] = await Promise.all([
      versionsPromise,
      draftsPromise,
    ]);
    if (versionsResult.error) throw versionsResult.error;
    if (draftsResult.error) throw draftsResult.error;

    const versionsById = new Map(
      (versionsResult.data ?? []).map((version) => [version.id, version]),
    );
    const draftIdByFormId = new Map(
      (draftsResult.data ?? []).map((draft) => [draft.form_id, draft.id]),
    );
    const draftIds = [...draftIdByFormId.values()];
    const questionCountByDraftId = new Map<string, number>();

    if (draftIds.length > 0) {
      const { data, error } = await this.client
        .from("form_draft_questions")
        .select("form_draft_id")
        .in("form_draft_id", draftIds);
      if (error) throw error;
      for (const link of data ?? []) {
        questionCountByDraftId.set(
          link.form_draft_id,
          (questionCountByDraftId.get(link.form_draft_id) ?? 0) + 1,
        );
      }
    }

    return rows.map((row) => {
      const version = row.current_form_version_id
        ? versionsById.get(row.current_form_version_id)
        : undefined;
      const draftId = draftIdByFormId.get(row.id);
      return {
        id: row.id,
        name: row.name,
        version: version?.version ?? null,
        state: (version?.state as FormPublicationState | undefined) ?? "draft",
        createdAt: row.created_at,
        questionCount: draftId
          ? (questionCountByDraftId.get(draftId) ?? 0)
          : 0,
        publishedAt: version?.published_at ?? null,
      };
    });
  }
}
