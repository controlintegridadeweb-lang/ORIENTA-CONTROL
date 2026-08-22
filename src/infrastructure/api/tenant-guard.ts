import { NextResponse } from "next/server";
import type { AuthContext } from "./auth";
import { isGlobalAdmin } from "@/infrastructure/auth/scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Supabase retorna joins !inner como objeto único ou array, dependendo da
 * cardinalidade inferida. Normaliza para extrair `organization_id`.
 */
function extractOrganizationId(
  joined: { organization_id: string } | { organization_id: string }[] | null | undefined,
): string | null {
  if (!joined) return null;
  const row = Array.isArray(joined) ? joined[0] : joined;
  return row?.organization_id ?? null;
}

/**
 * Garante que o usuário tem acesso à organização informada.
 * - administrador único e global: visão cross-org
 * - respondente: somente a própria organização
 */
export function ensureOrganizationAccess(context: AuthContext, organizationId: string) {
  if (isGlobalAdmin(context)) {
    return null;
  }
  if (!context.organizationId) {
    return forbidden("Usuário sem organização vinculada.");
  }
  if (context.organizationId !== organizationId) {
    return forbidden("Acesso fora da organização permitida.");
  }
  return null;
}

export async function ensureRecommendationAccess(context: AuthContext, recommendationId: string) {
  // O administrador único é global e pode operar em qualquer organização.
  if (isGlobalAdmin(context)) {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("recommendations")
      .select("id")
      .eq("id", recommendationId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Recomendação não encontrada." }, { status: 404 });
    }
    return null;
  }

  if (!context.organizationId) {
    return forbidden("Usuário sem organização vinculada.");
  }

  const supabase = createSupabaseServiceRoleClient();
  // A organização da recomendação vem do ciclo (recommendations.cycle_id →
  // cycles.organization_id). Não há coluna organization_id em recommendations
  // — o schema é cycle-cêntrico.
  const { data, error } = await supabase
    .from("recommendations")
    .select("cycles!inner(organization_id)")
    .eq("id", recommendationId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Recomendação não encontrada." }, { status: 404 });
  }

  const orgId = extractOrganizationId(data.cycles);
  if (orgId !== context.organizationId) {
    return forbidden("Acesso fora da organização permitida.");
  }
  return null;
}
