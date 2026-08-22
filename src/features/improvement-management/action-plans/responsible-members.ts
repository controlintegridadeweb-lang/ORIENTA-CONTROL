import "server-only";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { ActionPlanResponsibleMember } from "./types";

/** Lista identidades elegíveis do órgão para atribuição e lembretes da ação. */
export async function listActionPlanResponsibleMembers(
  organizationId: string,
): Promise<ActionPlanResponsibleMember[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("list_organization_respondents", {
    p_organization_id: organizationId,
  });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const email = row.email?.trim() || null;
    return {
      userId: row.user_id,
      name: row.full_name?.trim() || email || "Respondente",
      email,
    } satisfies ActionPlanResponsibleMember;
  });
}
