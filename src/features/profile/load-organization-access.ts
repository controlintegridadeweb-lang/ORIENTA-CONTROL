import "server-only";

import type { OrganizationAccessMember } from "@/features/profile/organization-access";
import { isRespondentAppointment } from "@/features/admin";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

/** Pessoas respondentes do órgão, com o cargo titular ou suplente. */
export async function loadOrganizationAccess(
  organizationId: string,
): Promise<OrganizationAccessMember[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("list_organization_respondents", {
    p_organization_id: organizationId,
  });
  if (error) throw error;

  const members = data ?? [];
  const userIds = members.map((member) => member.user_id);
  const appointmentByUser = new Map<string, OrganizationAccessMember["appointment"]>();

  if (userIds.length > 0) {
    const { data: details, error: detailsError } = await supabase
      .from("respondent_profile_details")
      .select("user_id, appointment")
      .in("user_id", userIds);
    if (detailsError) throw detailsError;
    for (const detail of details ?? []) {
      const appointment = detail.appointment;
      appointmentByUser.set(
        detail.user_id,
        appointment && isRespondentAppointment(appointment) ? appointment : null,
      );
    }
  }

  return members.map((member) => ({
    userId: member.user_id,
    fullName: member.full_name,
    email: member.email,
    appointment: appointmentByUser.get(member.user_id) ?? null,
  }));
}
