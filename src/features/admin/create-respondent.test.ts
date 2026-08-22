import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DomainConflictError,
  DomainUnavailableError,
  DomainValidationError,
} from "@/infrastructure/api/domain-errors";

/**
 * Foco: a criação de respondente cria conta Auth + profile vinculado à org, e
 * — ponto crítico — se o insert do profile falhar, a conta Auth recém-criada é
 * REMOVIDA (compensação), para nunca deixar usuário órfão (o app recusa login
 * sem profile). Também valida org obrigatória e e-mail duplicado.
 */

const state: {
  orgExists: boolean;
  createUserResult: {
    data: { user: { id: string } } | null;
    error: { message: string } | null;
  };
  profileRpcError: { message: string } | null;
  deleteUserError: { message: string } | null;
  resetEmailError: { message: string } | null;
  deletedUserIds: string[];
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
  generatedLink: string | null;
  generatedHashedToken: string | null;
  generatedLinkError: { message: string } | null;
  profileRole: "respondent" | "admin" | null;
  profileFetchError: { message: string } | null;
  updateProfileRpcError: { message: string } | null;
  authUserEmail: string | null;
  authUserFetchError: { message: string } | null;
  updateUserErrors: Array<{ message: string } | null>;
  updatedEmails: string[];
} = {
  orgExists: true,
  createUserResult: { data: { user: { id: "new-user-1" } }, error: null },
  profileRpcError: null,
  deleteUserError: null,
  resetEmailError: { message: "SMTP indisponível" },
  deletedUserIds: [],
  rpcCalls: [],
  generatedLink: "https://supabase.invalid/verify",
  generatedHashedToken: "hashed-token-abc",
  generatedLinkError: null,
  profileRole: "respondent",
  profileFetchError: null,
  updateProfileRpcError: null,
  authUserEmail: "old@org.gov.br",
  authUserFetchError: null,
  updateUserErrors: [],
  updatedEmails: [],
};

vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.orgExists ? { id: "org-a" } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.profileRole
                  ? { role: state.profileRole, full_name: "Nome", organization_id: "org-a" }
                  : null,
                error: state.profileFetchError,
              }),
            }),
          }),
        };
      }
      return {};
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      if (name === "create_respondent_profile") {
        return { data: null, error: state.profileRpcError };
      }
      if (name === "update_respondent_profile") {
        return { data: null, error: state.updateProfileRpcError };
      }
      return { data: null, error: { message: `rpc_not_implemented:${name}` } };
    },
    auth: {
      resetPasswordForEmail: async () => ({ error: state.resetEmailError }),
      admin: {
        createUser: async () => state.createUserResult,
        getUserById: async () => ({
          data: { user: state.authUserEmail ? { email: state.authUserEmail } : null },
          error: state.authUserFetchError,
        }),
        updateUserById: async (_id: string, payload: { email?: string }) => {
          if (payload.email) state.updatedEmails.push(payload.email);
          return { error: state.updateUserErrors.shift() ?? null };
        },
        deleteUser: async (id: string) => {
          state.deletedUserIds.push(id);
          return { error: state.deleteUserError };
        },
        generateLink: async () => ({
          data: {
            properties: {
              action_link: state.generatedLink,
              hashed_token: state.generatedHashedToken,
            },
          },
          error: state.generatedLinkError,
        }),
      },
    },
  })),
}));

import {
  createRespondentUser,
  removeUserAdmin,
  updateUserProfileAdmin,
} from "./users-service";

beforeEach(() => {
  state.orgExists = true;
  state.createUserResult = {
    data: { user: { id: "new-user-1" } },
    error: null,
  };
  state.profileRpcError = null;
  state.deleteUserError = null;
  state.resetEmailError = { message: "SMTP indisponível" };
  state.deletedUserIds = [];
  state.rpcCalls = [];
  state.generatedLink = "https://supabase.invalid/verify";
  state.generatedHashedToken = "hashed-token-abc";
  state.generatedLinkError = null;
  state.profileRole = "respondent";
  state.profileFetchError = null;
  state.updateProfileRpcError = null;
  state.authUserEmail = "old@org.gov.br";
  state.authUserFetchError = null;
  state.updateUserErrors = [];
  state.updatedEmails = [];
});

describe("createRespondentUser", () => {
  it("exige organização válida (uuid)", async () => {
    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "nao-e-uuid",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("falha se a organização não existir", async () => {
    state.orgExists = false;
    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("cria conta + profile e gera link quando sem senha provisória", async () => {
    const result = await createRespondentUser({
      email: "r@org.gov.br",
      organizationId: "33333333-3333-4333-8333-333333333333",
      actorUserId: "admin-1",
    });
    expect(result.userId).toBe("new-user-1");
    expect(result.accessMethod).toBe("recovery_link");
    expect(result.recoveryLink).toContain("/auth/update-password?");
    expect(result.recoveryLink).toContain("token_hash=hashed-token-abc");
    expect(result.recoveryLink).toContain("type=recovery");
    expect(state.deletedUserIds).toHaveLength(0);
    expect(state.rpcCalls).toEqual([
      {
        name: "create_respondent_profile",
        args: {
          p_user_id: "new-user-1",
          p_email: "r@org.gov.br",
          p_full_name: "",
          p_organization_id: "33333333-3333-4333-8333-333333333333",
          p_actor_user_id: "admin-1",
        },
      },
    ]);
  });

  it("registra acesso por e-mail quando o provedor aceita a solicitação", async () => {
    state.resetEmailError = null;

    const result = await createRespondentUser({
      email: "r@org.gov.br",
      organizationId: "33333333-3333-4333-8333-333333333333",
      actorUserId: "admin-1",
    });

    expect(result.accessMethod).toBe("email");
    expect(result.recoveryLink).toBeNull();
    expect(state.deletedUserIds).toHaveLength(0);
  });

  it("reconhece a senha provisória como meio de acesso válido", async () => {
    const result = await createRespondentUser({
      email: "r@org.gov.br",
      organizationId: "33333333-3333-4333-8333-333333333333",
      password: "SenhaSegura123!",
      actorUserId: "admin-1",
    });

    expect(result.accessMethod).toBe("temporary_password");
    expect(result.recoveryLink).toBeNull();
    expect(state.deletedUserIds).toHaveLength(0);
  });

  it("desfaz a criação quando e-mail e geração do link falham", async () => {
    state.generatedLinkError = { message: "Serviço de links indisponível" };

    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainUnavailableError);
    expect(state.deletedUserIds).toEqual(["new-user-1"]);
  });

  it("desfaz a criação quando o provedor não retorna o link gerado", async () => {
    state.generatedHashedToken = null;

    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainUnavailableError);
    expect(state.deletedUserIds).toEqual(["new-user-1"]);
  });

  it("COMPENSA: remove a conta Auth se o profile falhar", async () => {
    state.profileRpcError = { message: "insert failed" };
    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeTruthy();
    expect(state.deletedUserIds).toEqual(["new-user-1"]);
  });

  it("sinaliza estado inconsistente quando a compensação do Auth falha", async () => {
    state.profileRpcError = { message: "insert failed" };
    state.deleteUserError = { message: "delete failed" };

    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow("respondent_creation_inconsistent_state");
    expect(state.deletedUserIds).toEqual(["new-user-1"]);
  });

  it("e-mail já registrado vira conflito", async () => {
    state.createUserResult = {
      data: null,
      error: {
        message: "A user with this email address has already been registered",
      },
    };
    await expect(
      createRespondentUser({
        email: "r@org.gov.br",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});


describe("admin user consistency", () => {
  it("não confirma remoção quando o Auth devolve erro", async () => {
    state.deleteUserError = { message: "delete failed" };

    await expect(removeUserAdmin("admin-1", "respondent-1")).rejects.toThrow(
      "delete failed",
    );
    expect(state.deletedUserIds).toEqual(["respondent-1"]);
  });

  it("restaura o e-mail anterior quando a atualização do perfil falha", async () => {
    state.updateProfileRpcError = { message: "profile update failed" };
    state.updateUserErrors = [null, null];

    await expect(
      updateUserProfileAdmin({
        userId: "respondent-1",
        fullName: "Novo nome",
        email: "novo@org.gov.br",
        role: "respondent",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow("profile update failed");

    expect(state.updatedEmails).toEqual(["novo@org.gov.br", "old@org.gov.br"]);
  });

  it("sinaliza inconsistência quando a restauração do e-mail também falha", async () => {
    state.updateProfileRpcError = { message: "profile update failed" };
    state.updateUserErrors = [null, { message: "rollback failed" }];

    await expect(
      updateUserProfileAdmin({
        userId: "respondent-1",
        fullName: "Novo nome",
        email: "novo@org.gov.br",
        role: "respondent",
        organizationId: "33333333-3333-4333-8333-333333333333",
        actorUserId: "admin-1",
      }),
    ).rejects.toThrow("user_update_inconsistent_state");
  });
});
