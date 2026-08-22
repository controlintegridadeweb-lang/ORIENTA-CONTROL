import "server-only";

import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import {
  DomainConflictError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";
import { logError } from "@/infrastructure/observability/logger";

/**
 * Serviço administrativo de organizações.
 *
 * Contexto de segurança: a tabela `public.organizations` tem RLS habilitada e
 * NÃO possui policy de INSERT/UPDATE/DELETE. Por desenho, a criação só é
 * possível via service role no servidor. Toda função aqui usa service role e,
 * portanto, DEVE ser chamada apenas após `requireRole(["admin"])` na camada de
 * Server Action / API. Estas funções não fazem a checagem de papel — quem chama
 * faz, exatamente como nas demais rotas administrativas do projeto.
 */

const orgNameSchema = z
  .string()
  .trim()
  .min(3, "O nome da organização precisa ter ao menos 3 caracteres.")
  .max(160, "O nome da organização é muito longo (máx. 160 caracteres).");

/**
 * Sigla do órgão. Formato derivado dos dados reais (PC/RN, IGARN, SEMJIDH,
 * EMATER/RN): letras maiúsculas, dígitos e barra, 2 a 12 caracteres. A entrada
 * é normalizada para maiúsculas ANTES da validação, então o usuário pode digitar
 * em qualquer caixa. A unicidade (case-insensitive) é garantida no banco.
 */
const orgAcronymSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .min(2, "A sigla precisa ter ao menos 2 caracteres.")
      .max(12, "A sigla é muito longa (máx. 12 caracteres).")
      .regex(
        /^[A-Z0-9/]+$/,
        "A sigla deve conter apenas letras, números e barra (ex.: PC/RN).",
      ),
  );


export const createOrganizationInputSchema = z
  .object({
    name: orgNameSchema,
    acronym: orgAcronymSchema,
  })
  .strict();

const createdOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  acronym: z.string(),
});

type OrganizationDetail = {
  id: string;
  name: string;
  acronym: string;
  createdAt: string;
  userCount: number;
  respondentCount: number;
};

/**
 * Lista organizações com contagem de perfis vinculados (para a tela admin).
 */
export type OrganizationsPage = {
  items: OrganizationDetail[];
  total: number;
  limit: number;
  offset: number;
};

export async function listOrganizationsDetailed(input: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<OrganizationsPage> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("list_organizations_page", {
    p_search: input.search?.trim() || undefined,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = data ?? [];
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      acronym: row.acronym,
      createdAt: row.created_at,
      userCount: Number(row.user_count),
      respondentCount: Number(row.respondent_count),
    })),
    total: Number(rows[0]?.total_count ?? 0),
    limit,
    offset,
  };
}


export type OrganizationOptionDetail = {
  id: string;
  name: string;
  acronym: string;
};

/** Carrega todas as organizações em páginas controladas para seletores operacionais. */
export async function listAllOrganizationOptions(): Promise<OrganizationOptionDetail[]> {
  const items: OrganizationOptionDetail[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const page = await listOrganizationsDetailed({ limit: pageSize, offset });
    items.push(...page.items.map(({ id, name, acronym }) => ({ id, name, acronym })));
    if (items.length >= page.total || page.items.length < pageSize) break;
  }
  return items;
}

/**
 * Cria uma organização. `name` e `acronym` são únicos no banco (a sigla de forma
 * case-insensitive); colisão em qualquer um vira conflito 409 com mensagem que
 * identifica o campo. A sigla é normalizada para maiúsculas na validação.
 */
export async function createOrganization(input: {
  name: string;
  acronym: string;
  actorUserId: string;
}): Promise<{ id: string; name: string; acronym: string }> {
  const parsed = createOrganizationInputSchema.safeParse({
    name: input.name,
    acronym: input.acronym,
  });
  if (!parsed.success) {
    throw new DomainValidationError(
      parsed.error.issues.map((issue) => ({
        path: String(issue.path[0] ?? ""),
        message: issue.message,
      })),
    );
  }
  const { name, acronym } = parsed.data;

  const supabase = createSupabaseServiceRoleClient();

  // Pré-checagem amigável por nome e por sigla (as constraints unique são a
  // garantia real; isto só melhora a mensagem no caso comum).
  const { data: byName, error: byNameError } = await supabase
    .from("organizations")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (byNameError) throw byNameError;
  if (byName) {
    throw new DomainConflictError("Já existe uma organização com esse nome.");
  }
  const { data: byAcronym, error: byAcronymError } = await supabase
    .from("organizations")
    .select("id")
    .ilike("acronym", acronym)
    .maybeSingle();
  if (byAcronymError) throw byAcronymError;
  if (byAcronym) {
    throw new DomainConflictError(`Já existe uma organização com a sigla "${acronym}".`);
  }

  const { data, error } = await supabase.rpc("create_organization_admin", {
    p_name: name,
    p_acronym: acronym,
    p_actor_user_id: input.actorUserId,
  });

  if (error) {
    // 23505 = unique_violation (corrida entre a pré-checagem e o insert). O
    // nome da constraint distingue qual campo colidiu, sem vazar o erro cru.
    if ((error as { code?: string }).code === "23505") {
      const constraint = (error as { constraint?: string }).constraint ?? "";
      if (constraint.includes("acronym")) {
        throw new DomainConflictError(`Já existe uma organização com a sigla "${acronym}".`);
      }
      throw new DomainConflictError("Já existe uma organização com esse nome.");
    }
    logError("Failed to create organization", error, { name, acronym });
    throw error;
  }

  const parsedOrganization = createdOrganizationSchema.safeParse(data);
  if (!parsedOrganization.success) {
    throw new Error("organization_creation_result_invalid");
  }

  return {
    id: parsedOrganization.data.id,
    name: parsedOrganization.data.name,
    acronym: parsedOrganization.data.acronym,
  };
}

