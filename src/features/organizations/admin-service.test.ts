import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DomainConflictError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";

/**
 * Mock do client service role. Cada teste injeta o comportamento das tabelas
 * relevantes. O foco é a lógica de validação/conflito/auditoria do serviço —
 * não o driver do Supabase.
 */
const state: {
  existingOrgByName: { id: string } | null;
  existingOrgByAcronym: { id: string } | null;
  rpcResult: {
    data: { id: string; name: string; acronym: string } | null;
    error: unknown;
  };
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
} = {
  existingOrgByName: null,
  existingOrgByAcronym: null,
  rpcResult: { data: null, error: null },
  rpcCalls: [],
};

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: (_cols: string) => ({
            ilike: (column: string) => ({
              maybeSingle: async () => ({
                data:
                  column === "acronym"
                    ? state.existingOrgByAcronym
                    : state.existingOrgByName,
                error: null,
              }),
            }),
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return state.rpcResult;
    },
  })),
}));

import { createOrganization } from "./admin-service";

const sampleInput = {
  name: "Secretaria Exemplo",
  acronym: "SEEX",
  actorUserId: "admin-1",
};

beforeEach(() => {
  state.existingOrgByName = null;
  state.existingOrgByAcronym = null;
  state.rpcResult = { data: null, error: null };
  state.rpcCalls = [];
});

describe("createOrganization", () => {
  it("rejeita nome muito curto (validação)", async () => {
    await expect(
      createOrganization({ name: "ab", acronym: "SE", actorUserId: "admin-1" }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("rejeita nome duplicado com conflito", async () => {
    state.existingOrgByName = { id: "org-existing" };
    await expect(createOrganization(sampleInput)).rejects.toBeInstanceOf(
      DomainConflictError,
    );
  });

  it("cria organização e registra auditoria", async () => {
    state.rpcResult = {
      data: { id: "org-new", name: "Secretaria Exemplo", acronym: "SEEX" },
      error: null,
    };
    const result = await createOrganization({
      name: "  Secretaria Exemplo  ",
      acronym: "seex",
      actorUserId: "admin-1",
    });
    expect(result).toEqual({
      id: "org-new",
      name: "Secretaria Exemplo",
      acronym: "SEEX",
    });
    expect(state.rpcCalls).toEqual([
      {
        name: "create_organization_admin",
        args: {
          p_name: "Secretaria Exemplo",
          p_acronym: "SEEX",
          p_actor_user_id: "admin-1",
        },
      },
    ]);
  });

  it("trata unique_violation (23505) como conflito mesmo sem pré-checagem", async () => {
    state.existingOrgByName = null;
    state.rpcResult = { data: null, error: { code: "23505" } };
    await expect(createOrganization(sampleInput)).rejects.toBeInstanceOf(
      DomainConflictError,
    );
  });
});
