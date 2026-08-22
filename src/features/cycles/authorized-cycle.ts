import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/infrastructure/api/auth";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import {
  resolveCycleOperationalScope,
  type CycleOperationalScope,
} from "@/infrastructure/supabase/cycle-operational-scope";

export type AuthorizedCycleScopeResult =
  | { scope: CycleOperationalScope; error: null }
  | { scope: null; error: NextResponse };

/**
 * Resolve um diagnóstico pelo identificador canônico e aplica, no mesmo ponto,
 * a regra de isolamento por organização.
 *
 * Rotas que usam service_role nunca devem consultar ou mutar um diagnóstico
 * apenas por conhecerem o `cycleId`: esta função é o gate obrigatório para
 * operações centradas no diagnóstico.
 */
export async function resolveAuthorizedCycleScope(
  supabase: SupabaseClient,
  auth: AuthContext,
  cycleId: string,
): Promise<AuthorizedCycleScopeResult> {
  const scope = await resolveCycleOperationalScope(supabase, cycleId);
  if (!scope) {
    return {
      scope: null,
      error: NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 }),
    };
  }

  const tenantError = ensureOrganizationAccess(auth, scope.cycle.organizationId);
  if (tenantError) return { scope: null, error: tenantError };

  return { scope, error: null };
}
