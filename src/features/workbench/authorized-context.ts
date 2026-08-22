import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/infrastructure/api/auth";
import { resolveAuthorizedCycleScope } from "@/features/cycles/server";
import { ensureRespondentAssignmentAccess } from "@/features/forms/server";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { CycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";

type AuthorizedWorkbenchContext = {
  auth: AuthContext;
  supabase: SupabaseClient;
  scope: CycleOperationalScope;
};

export type AuthorizedWorkbenchResult =
  | { context: AuthorizedWorkbenchContext; error: null }
  | { context: null; error: NextResponse };

/**
 * Única fronteira de autorização do workbench.
 *
 * Resolve o ciclo canônico, aplica isolamento por organização e confirma o
 * vínculo do formulário para respondentes. Rotas do workbench não devem
 * repetir essas verificações individualmente.
 */
export async function resolveAuthorizedWorkbenchContext(
  auth: AuthContext,
  cycleId: string,
  supabase: SupabaseClient = createSupabaseServiceRoleClient(),
): Promise<AuthorizedWorkbenchResult> {
  const access = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
  if (access.scope === null) return { context: null, error: access.error };

  const assignmentError = await ensureRespondentAssignmentAccess(
    auth.role,
    access.scope.formId,
    access.scope.cycle.organizationId,
  );
  if (assignmentError) return { context: null, error: assignmentError };

  return {
    context: { auth, supabase, scope: access.scope },
    error: null,
  };
}
