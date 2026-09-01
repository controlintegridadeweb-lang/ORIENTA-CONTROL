import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import type { AppRole } from "@/infrastructure/api/auth";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import {
  DomainNotFoundError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { loadRecommendationScope } from "./cycle-read-model";

export type Client = SupabaseClient;
export type Caller = { role: AppRole; organizationId: string | null };

// Marcadores semanticos finos sobre as classes genericas de
// @/infrastructure/api/domain-errors; o mapeamento para HTTP vive em handleDomainError.
export class ActionPlansValidationError extends DomainValidationError {
  constructor(issues: { path: string; message: string }[]) {
    super(issues, "Dados inválidos para plano de integridade e compliance.");
    this.name = "ActionPlansValidationError";
  }
}

export class ActionPlansNotFoundError extends DomainNotFoundError {
  constructor(message = "Plano ou recomendação não encontrado.") {
    super(message);
    this.name = "ActionPlansNotFoundError";
  }
}

export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.map((p) => String(p)).join(".") || "_",
      message: i.message,
    }));
    throw new ActionPlansValidationError(
      issues.length > 0 ? issues : [{ path: "_", message: "Dados inválidos." }],
    );
  }
  return parsed.data;
}

export function enforceOrgScope(caller: Caller, rowOrganizationId: string) {
  if (isGlobalAdmin(caller)) return;
  if (!caller.organizationId || caller.organizationId !== rowOrganizationId) {
    throw new ActionPlansNotFoundError();
  }
}

export async function assertRecommendationScope(
  client: Client,
  recommendationId: string,
  caller: Caller,
) {
  const scope = await loadRecommendationScope(client, recommendationId);
  if (!scope) throw new ActionPlansNotFoundError("Recomendação não encontrada.");
  enforceOrgScope(caller, scope.organizationId);
}
