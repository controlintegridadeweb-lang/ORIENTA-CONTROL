import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type { FormAssignment } from "./types";

const FORM_ASSIGNMENTS_TABLE = "form_assignments";

type Client = SupabaseClient;

type AssignmentRow = {
  id: string;
  form_id: string;
  organization_id: string;
  assigned_at: string;
  assigned_by: string | null;
  organizations?: { name: string } | { name: string }[] | null;
};

function mapRow(row: AssignmentRow): FormAssignment {
  const orgRel = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations;
  return {
    id: row.id,
    formId: row.form_id,
    organizationId: row.organization_id,
    organizationName: orgRel?.name ?? "",
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
  };
}

export class FormAssignmentsRepository {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async listByFormId(formId: string): Promise<FormAssignment[]> {
    const { data, error } = await this.supabase
      .from(FORM_ASSIGNMENTS_TABLE)
      .select(
        "id,form_id,organization_id,assigned_at,assigned_by,organizations(name)",
      )
      .eq("form_id", formId)
      .order("assigned_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapRow(row as AssignmentRow));
  }

  async listOrganizationIdsByFormId(formId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(FORM_ASSIGNMENTS_TABLE)
      .select("organization_id")
      .eq("form_id", formId);
    if (error) throw error;
    return (data ?? []).map(
      (row) => (row as { organization_id: string }).organization_id,
    );
  }

  async listFormIdsByOrganizationId(organizationId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from(FORM_ASSIGNMENTS_TABLE)
      .select("form_id")
      .eq("organization_id", organizationId);
    if (error) throw error;
    return (data ?? []).map((row) => (row as { form_id: string }).form_id);
  }

  async isAssigned(formId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(FORM_ASSIGNMENTS_TABLE)
      .select("id")
      .eq("form_id", formId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async listOrganizationIdsWithCycles(
    formId: string,
    organizationIds?: string[],
  ): Promise<string[]> {
    if (organizationIds?.length === 0) return [];

    let query = this.supabase
      .from("cycles")
      .select("organization_id, form_versions!inner(form_id)")
      .eq("form_versions.form_id", formId);
    if (organizationIds) query = query.in("organization_id", organizationIds);

    const { data, error } = await query;
    if (error) throw error;
    return Array.from(
      new Set(
        (data ?? []).map(
          (row) => (row as { organization_id: string }).organization_id,
        ),
      ),
    );
  }

  async syncAssignments(
    formId: string,
    organizationIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const { error } = await this.supabase.rpc("sync_form_assignments", {
      p_form_id: formId,
      p_organization_ids: organizationIds,
      p_actor_user_id: actorUserId,
    });
    if (error) throw error;
  }

}
