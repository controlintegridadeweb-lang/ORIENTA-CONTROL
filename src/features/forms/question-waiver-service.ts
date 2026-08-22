import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkValues } from "@/infrastructure/supabase/pagination";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

type Client = SupabaseClient;

export type QuestionWaiver = {
  organizationId: string;
  questionId: string;
  reason: string | null;
  waivedBy: string;
  waivedAt: string;
};

export type SetWaiverInput = {
  organizationId: string;
  questionId: string;
  reason?: string | null;
  waivedBy: string;
};

type ReplaceWaiversInput = {
  questionId: string;
  scopeOrganizationIds: string[];
  waivers: Array<{ organizationId: string; reason: string | null }>;
  waivedBy: string;
};

/**
 * Regra de aplicabilidade por organização, definida por par (pergunta, organização).
 * É independente de formulário e vale em qualquer formulário que inclua a pergunta.
 */
export class QuestionWaiverService {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async replaceWaiversForQuestion(input: ReplaceWaiversInput): Promise<void> {
    const { error } = await this.supabase.rpc(
      "replace_question_organization_waivers",
      {
        p_question_id: input.questionId,
        p_scope_organization_ids: input.scopeOrganizationIds,
        p_waivers: input.waivers,
        p_waived_by: input.waivedBy,
      },
    );
    if (error) throw error;
  }

  async setWaiver(input: SetWaiverInput): Promise<QuestionWaiver> {
    const { data, error } = await this.supabase
      .from("question_organization_waivers")
      .upsert(
        {
          organization_id: input.organizationId,
          question_id: input.questionId,
          reason: input.reason?.trim() || null,
          waived_by: input.waivedBy,
          waived_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,question_id" },
      )
      .select("organization_id,question_id,reason,waived_by,waived_at")
      .single();
    if (error) throw error;
    return mapWaiverRow(data);
  }

  async clearWaiver(input: {
    organizationId: string;
    questionId: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("question_organization_waivers")
      .delete()
      .eq("organization_id", input.organizationId)
      .eq("question_id", input.questionId);
    if (error) throw error;
  }

  async listWaiversForOrg(organizationId: string): Promise<QuestionWaiver[]> {
    return this.listWaiversForOrganizations([organizationId]);
  }

  async listWaiversForOrganizations(
    organizationIds: string[],
  ): Promise<QuestionWaiver[]> {
    const uniqueIds = [...new Set(organizationIds)];
    if (uniqueIds.length === 0) return [];

    const waivers: QuestionWaiver[] = [];
    for (const organizationIdChunk of chunkValues(uniqueIds)) {
      const { data, error } = await this.supabase
        .from("question_organization_waivers")
        .select("organization_id,question_id,reason,waived_by,waived_at")
        .in("organization_id", organizationIdChunk);
      if (error) throw error;
      waivers.push(...(data ?? []).map(mapWaiverRow));
    }

    return waivers;
  }

  async listWaivedQuestionIdsForOrg(
    organizationId: string,
  ): Promise<Set<string>> {
    const rows = await this.listWaiversForOrg(organizationId);
    return new Set(rows.map((r) => r.questionId));
  }

  /** Ciclos da organização cuja versão congelada contém a pergunta. */
  async listCycleIdsContainingQuestion(
    organizationId: string,
    questionId: string,
  ): Promise<string[]> {
    const { data: questionRows, error: questionError } = await this.supabase
      .from("form_questions")
      .select("form_version_id, question_versions!inner(question_id)")
      .eq("question_versions.question_id", questionId);
    if (questionError) throw questionError;

    const formVersionIds = [
      ...new Set(
        (questionRows ?? [])
          .map((row) => row.form_version_id as string)
          .filter(Boolean),
      ),
    ];
    if (formVersionIds.length === 0) return [];

    const { data: cycleRows, error: cycleError } = await this.supabase
      .from("cycles")
      .select("id")
      .eq("organization_id", organizationId)
      .in("form_version_id", formVersionIds);
    if (cycleError) throw cycleError;

    return [
      ...new Set(
        (cycleRows ?? []).map((row) => row.id as string).filter(Boolean),
      ),
    ];
  }
}

function mapWaiverRow(row: unknown): QuestionWaiver {
  const r = row as Record<string, unknown>;
  return {
    organizationId: String(r.organization_id ?? ""),
    questionId: String(r.question_id ?? ""),
    reason: (r.reason as string | null) ?? null,
    waivedBy: String(r.waived_by ?? ""),
    waivedAt: String(r.waived_at ?? ""),
  };
}
