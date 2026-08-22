import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { z } from "zod";
import { logInfo } from "@/infrastructure/observability/logger";
import { LibraryValidationError } from "./service";
import { LibraryConflictError } from "./errors";
import { businessToday } from "@/shared/datetime/business-date";
import type {
  RecommendationException,
  RecommendationExceptionStatus,
} from "./exceptions-types";

export type { RecommendationException } from "./exceptions-types";

type Row = {
  id: string;
  organization_id: string;
  recommendation_id: string;
  question_id: string | null;
  motivo: string;
  prazo: string | null;
  status: RecommendationExceptionStatus;
  requested_by: string | null;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Row): RecommendationException {
  return {
    id: row.id,
    organizationId: row.organization_id,
    recommendationId: row.recommendation_id,
    questionId: row.question_id,
    motivo: row.motivo,
    prazo: row.prazo,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwExceptionWriteError(error: unknown): never {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (message.includes("recommendation_exception_has_active_action")) {
    throw new LibraryConflictError(
      "Cancele as ações ainda ativas antes de solicitar uma exceção para esta recomendação.",
    );
  }
  if (message.includes("recommendation_exception_cycle_not_editable")) {
    throw new LibraryConflictError(
      "A exceção só pode ser solicitada durante a execução do plano de ação.",
    );
  }
  if (message.includes("recommendation_exception_not_current")) {
    throw new LibraryConflictError("A recomendação não é mais a versão oficial atual.");
  }
  if (code === "23505") {
    throw new LibraryConflictError(
      "Já existe uma solicitação pendente ou uma exceção aprovada para esta recomendação.",
    );
  }
  throw error;
}

const exceptionRequestSchema = z.object({
  organizationId: z.string().uuid(),
  recommendationId: z.string().uuid(),
  questionId: z.string().uuid().optional().nullable(),
  motivo: z.string().trim().min(20, "Motivo deve ter pelo menos 20 caracteres.").max(4000),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Prazo em formato YYYY-MM-DD.").optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.prazo && value.prazo < businessToday()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["prazo"],
      message: "O prazo da exceção não pode estar no passado.",
    });
  }
});

const exceptionDecisionSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

const recommendationScopeSchema = z.object({
  question_versions: z.object({ question_id: z.string().uuid() }),
  cycles: z.object({
    organization_id: z.string().uuid(),
    state: z.string(),
  }),
});

export class ExceptionsService {
  private supabase: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  private async assertRecommendationScope(
    recommendationId: string,
    organizationId: string,
    questionId: string | null | undefined,
  ): Promise<void> {
    const [{ data, error }, currentResult] = await Promise.all([
      this.supabase
        .from("recommendations")
        .select("question_versions!inner(question_id),cycles!inner(organization_id,state)")
        .eq("id", recommendationId)
        .maybeSingle(),
      this.supabase.rpc("is_current_official_recommendation", {
        p_recommendation_id: recommendationId,
      }),
    ]);
    if (error) throw error;
    if (currentResult.error) throw currentResult.error;
    if (!data || currentResult.data !== true) {
      throw new LibraryValidationError([
        { path: "recommendationId", message: "Recomendação oficial atual não encontrada." },
      ]);
    }
    const scope = recommendationScopeSchema.parse(data);
    if (scope.cycles.organization_id !== organizationId) {
      throw new LibraryValidationError([
        { path: "recommendationId", message: "A recomendação não pertence à organização informada." },
      ]);
    }
    if (scope.cycles.state !== "validated") {
      throw new LibraryConflictError(
        "A exceção só pode ser solicitada durante a execução do plano de ação.",
      );
    }
    if (questionId && scope.question_versions.question_id !== questionId) {
      throw new LibraryValidationError([
        { path: "questionId", message: "A pergunta não corresponde à recomendação informada." },
      ]);
    }
  }

  private async expireOverdueRequests(recommendationId?: string): Promise<void> {
    let query = this.supabase
      .from("recommendation_exceptions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("status", "requested")
      .lt("prazo", businessToday());
    if (recommendationId) query = query.eq("recommendation_id", recommendationId);
    const { error } = await query;
    if (error) throw error;
  }

  async request(
    payload: unknown,
    actor: { userId: string },
  ): Promise<RecommendationException> {
    const parsed = exceptionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new LibraryValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "_",
          message: issue.message,
        })),
      );
    }
    await this.assertRecommendationScope(
      parsed.data.recommendationId,
      parsed.data.organizationId,
      parsed.data.questionId,
    );
    const { data: activeActions, error: activeActionsError } = await this.supabase
      .from("action_plans")
      .select("id")
      .eq("recommendation_id", parsed.data.recommendationId)
      .neq("status", "cancelled")
      .limit(1);
    if (activeActionsError) throw activeActionsError;
    if ((activeActions ?? []).length > 0) {
      throw new LibraryConflictError(
        "Cancele as ações ainda ativas antes de solicitar uma exceção para esta recomendação.",
      );
    }
    await this.expireOverdueRequests(parsed.data.recommendationId);
    const { data: existing, error: existingError } = await this.supabase
      .from("recommendation_exceptions")
      .select("id,status")
      .eq("recommendation_id", parsed.data.recommendationId)
      .in("status", ["requested", "approved"])
      .limit(1);
    if (existingError) throw existingError;
    if ((existing ?? []).length > 0) {
      throw new LibraryConflictError(
        existing?.[0]?.status === "approved"
          ? "Esta recomendação já possui uma exceção aprovada."
          : "Já existe uma solicitação de exceção pendente para esta recomendação.",
      );
    }

    const { data, error } = await this.supabase
      .from("recommendation_exceptions")
      .insert({
        organization_id: parsed.data.organizationId,
        recommendation_id: parsed.data.recommendationId,
        question_id: parsed.data.questionId ?? null,
        motivo: parsed.data.motivo,
        prazo: parsed.data.prazo ?? null,
        status: "requested",
        requested_by: actor.userId,
      })
      .select("*")
      .single();
    if (error) throwExceptionWriteError(error);
    logInfo("library.exception.requested", {
      recommendationId: parsed.data.recommendationId,
      organizationId: parsed.data.organizationId,
    });
    return mapRow(data as Row);
  }

  async decide(
    id: string,
    payload: unknown,
    actor: { userId: string },
  ): Promise<RecommendationException> {
    const parsed = exceptionDecisionSchema.safeParse(payload);
    if (!parsed.success) {
      throw new LibraryValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "_",
          message: issue.message,
        })),
      );
    }
    await this.expireOverdueRequests();
    const decidedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("recommendation_exceptions")
      .update({
        status: parsed.data.status,
        decided_by: actor.userId,
        decided_at: decidedAt,
      })
      .eq("id", id)
      .eq("status", "requested")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new LibraryConflictError(
        "A exceção não está mais pendente ou não foi encontrada.",
      );
    }
    logInfo("library.exception.decided", {
      id,
      status: parsed.data.status,
      actorUserId: actor.userId,
    });
    return mapRow(data as Row);
  }

  async listByOrg(organizationId: string): Promise<RecommendationException[]> {
    await this.expireOverdueRequests();
    const { data, error } = await this.supabase
      .from("recommendation_exceptions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as Row));
  }
}
