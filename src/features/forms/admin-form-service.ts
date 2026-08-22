import { hasDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { z } from "zod";
import { logInfo } from "@/infrastructure/observability/logger";
import { createFormSchema, renameFormSchema } from "./schemas";
import {
  FormsConflictError,
  parseFormsInput,
  type FormSummary,
} from "./admin-domain";
import { FormsAdminRepository } from "./admin-repository";


const createdFormRowSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  current_form_version_id: z.string().min(1).nullable(),
  created_at: z.string(),
  created_by: z.string().min(1),
});

export type FormsPage = {
  items: FormSummary[];
  total: number;
  limit: number;
  offset: number;
};

export class FormsAdminFormService {
  constructor(private readonly repository: FormsAdminRepository) {}

  async list(): Promise<FormSummary[]> {
    const items: FormSummary[] = [];
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await this.listPage({ limit, offset });
      items.push(...page.items);
      if (items.length >= page.total || page.items.length < limit) break;
    }
    return items;
  }


  async listPage(input: {
    state?: string | null;
    search?: string | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<FormsPage> {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const { data, error } = await this.repository.client.rpc("list_forms_page", {
      p_state: input.state?.trim() || undefined,
      p_search: input.search?.trim() || undefined,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        version: row.version,
        state: row.publication_state as FormSummary["state"],
        createdAt: row.created_at,
        questionCount: Number(row.question_count),
        publishedAt: row.published_at,
      })),
      total: Number(rows[0]?.total_count ?? 0),
      limit,
      offset,
    };
  }

  async getById(formId: string): Promise<FormSummary> {
    return this.repository.toSummary(await this.repository.loadFormRow(formId));
  }

  async create(
    input: unknown,
    actor: { userId: string },
  ): Promise<FormSummary> {
    const value = parseFormsInput(createFormSchema, input);
    const { data, error } = await this.repository.client.rpc("create_form_with_draft", {
      p_name: value.name,
      p_actor_user_id: actor.userId,
    });
    if (error) {
      this.throwNameConflict(error);
      throw error;
    }
    const parsedRow = createdFormRowSchema.safeParse(data);
    if (!parsedRow.success) {
      throw new Error("form_creation_result_invalid");
    }
    const row = parsedRow.data;
    logInfo("forms.admin.created", {
      formId: row.id,
      actorUserId: actor.userId,
    });
    return this.repository.toSummary(row);
  }

  async rename(formId: string, input: unknown): Promise<FormSummary> {
    const value = parseFormsInput(renameFormSchema, input);
    const form = await this.repository.loadFormRow(formId);
    if (form.current_form_version_id) {
      throw new FormsConflictError(
        "O nome não pode ser alterado depois da primeira publicação.",
      );
    }

    const { data, error } = await this.repository.client
      .from("forms")
      .update({ name: value.name })
      .eq("id", formId)
      .select("id,name,current_form_version_id,created_at,created_by")
      .single();
    if (error) {
      this.throwNameConflict(error);
      throw error;
    }
    const parsedRow = createdFormRowSchema.safeParse(data);
    if (!parsedRow.success) {
      throw new Error("form_update_result_invalid");
    }
    return this.repository.toSummary(parsedRow.data);
  }

  async deleteForm(formId: string, actor: { userId: string }): Promise<void> {
    const { error } = await this.repository.client.rpc("delete_unpublished_form", {
      p_form_id: formId,
      p_actor_user_id: actor.userId,
    });
    if (error) {
      if (hasDatabaseErrorCode(error, "published_form_cannot_be_deleted")) {
        throw new FormsConflictError(
          "Apenas formulários nunca publicados podem ser excluídos.",
        );
      }
      throw error;
    }
    logInfo("forms.admin.deleted", { formId, actorUserId: actor.userId });
  }

  private throwNameConflict(error: { code?: string }): void {
    if (error.code === "23505") {
      throw new FormsConflictError(
        "Já existe um formulário com esse nome. Use um nome diferente.",
      );
    }
  }
}
