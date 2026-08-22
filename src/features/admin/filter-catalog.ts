import "server-only";

import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

export type FormFilterOption = {
  id: string;
  name: string;
  version: number;
};

export type OrganizationFilterOption = {
  id: string;
  name: string;
  acronym: string;
};

const FORMS_PAGE_SIZE = 100;
const ORGANIZATIONS_PAGE_SIZE = 500;

/**
 * Carrega opções de formulário em páginas controladas no PostgreSQL.
 * Evita que seletores dependam do limite implícito do PostgREST.
 */
export async function listFormFilterOptions(
  client: TypedSupabaseClient,
  input: { publishedOnly?: boolean } = {},
): Promise<FormFilterOption[]> {
  const items: FormFilterOption[] = [];
  for (let offset = 0; ; offset += FORMS_PAGE_SIZE) {
    const { data, error } = await client.rpc("list_forms_page", {
      p_state: input.publishedOnly ? "published" : undefined,
      p_search: undefined,
      p_limit: FORMS_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    items.push(
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        version: Number(row.version ?? 0),
      })),
    );
    const total = Number(rows[0]?.total_count ?? 0);
    if (items.length >= total || rows.length < FORMS_PAGE_SIZE) break;
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Carrega organizações em páginas controladas para filtros e seletores. */
export async function listOrganizationFilterOptions(
  client: TypedSupabaseClient,
): Promise<OrganizationFilterOption[]> {
  const items: OrganizationFilterOption[] = [];
  for (let offset = 0; ; offset += ORGANIZATIONS_PAGE_SIZE) {
    const { data, error } = await client.rpc("list_organizations_page", {
      p_search: undefined,
      p_limit: ORGANIZATIONS_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    items.push(
      ...rows.map((row) => ({
        id: row.id,
        name: row.name,
        acronym: row.acronym,
      })),
    );
    const total = Number(rows[0]?.total_count ?? 0);
    if (items.length >= total || rows.length < ORGANIZATIONS_PAGE_SIZE) break;
  }
  return items;
}

/** Tipos existentes de recomendação, agregados no banco. */
export async function listRecommendationTypeOptions(
  client: TypedSupabaseClient,
): Promise<string[]> {
  const { data, error } = await client.rpc("list_recommendation_types");
  if (error) throw error;
  return (data ?? []).map((row) => row.type).filter(Boolean);
}

export type FormAssignmentFilterOption = {
  formId: string;
  organizationId: string;
};

/** Vínculos de formulário em páginas controladas para a abertura em lote. */
export async function listFormAssignmentFilterOptions(
  client: TypedSupabaseClient,
  formIds: string[],
): Promise<FormAssignmentFilterOption[]> {
  if (formIds.length === 0) return [];
  const items: FormAssignmentFilterOption[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.rpc("list_form_assignments_page", {
      p_form_ids: formIds,
      p_limit: pageSize,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    items.push(
      ...rows.map((row) => ({
        formId: row.form_id,
        organizationId: row.organization_id,
      })),
    );
    const total = Number(rows[0]?.total_count ?? 0);
    if (items.length >= total || rows.length < pageSize) break;
  }
  return items;
}
