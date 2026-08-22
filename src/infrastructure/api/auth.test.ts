import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Garantias de segurança de `requireAuth` após a remoção dos bypasses de dev.
 *
 * Estes testes cravam que:
 *   1. requisição sem credencial é rejeitada (401);
 *   2. headers `x-user-id` / `x-user-role` NÃO concedem identidade (o antigo
 *      bypass de desenvolvimento está morto);
 *   3. papel fora de `allowedRoles` é barrado (403);
 *   4. Bearer token válido + papel permitido produz o contexto correto.
 *
 * Mockamos as duas fronteiras externas: o cliente Auth por Bearer
 * (`@supabase/supabase-js`) e a sessão por cookie (`auth-server`). O próprio
 * perfil é lido com a mesma sessão autenticada, sujeito à RLS.
 */

const getUserMock = vi.fn();
const profileMaybeSingleMock = vi.fn();
const bearerAssuranceMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      mfa: { getAuthenticatorAssuranceLevel: bearerAssuranceMock },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: profileMaybeSingleMock,
        }),
      }),
    }),
  })),
}));

const cookieGetUserMock = vi.fn();
const cookieAssuranceMock = vi.fn();
vi.mock("@/infrastructure/supabase/auth-server", () => ({
  createSupabaseServerActionClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: cookieGetUserMock,
      mfa: { getAuthenticatorAssuranceLevel: cookieAssuranceMock },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: profileMaybeSingleMock,
        }),
      }),
    }),
  }),
}));

import { requireAuth } from "./auth";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
  // Sem sessão por cookie por padrão.
  cookieGetUserMock.mockResolvedValue({ data: { user: null }, error: null });
  bearerAssuranceMock.mockResolvedValue({
    data: { currentLevel: "aal2", nextLevel: "aal2" },
    error: null,
  });
  cookieAssuranceMock.mockResolvedValue({
    data: { currentLevel: "aal1", nextLevel: "aal1" },
    error: null,
  });
});

function bearerRequest(token: string | null, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  } else {
    headers.origin = headers.origin ?? "http://localhost";
    headers["sec-fetch-site"] = headers["sec-fetch-site"] ?? "same-origin";
  }
  return new Request("http://localhost/api/anything", { method: "POST", headers });
}

describe("requireAuth — sem bypass de desenvolvimento", () => {
  it("rejeita (401) requisicao sem token e sem sessao", async () => {
    const { context, error } = await requireAuth(bearerRequest(null), ["admin"]);
    expect(context).toBeNull();
    expect(error?.status).toBe(401);
  });

  it("ignora headers x-user-id / x-user-role (bypass morto)", async () => {
    // Cliente afirma ser admin via header; sem token/sessao reais → 401.
    const req = bearerRequest(null, {
      "x-user-id": VALID_UUID,
      "x-user-role": "admin",
    });
    const { context, error } = await requireAuth(req, ["admin"]);
    expect(context).toBeNull();
    expect(error?.status).toBe(401);
    // E o perfil nunca foi consultado a partir do header.
    expect(profileMaybeSingleMock).not.toHaveBeenCalled();
  });

  it("barra (403) papel fora de allowedRoles", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null });
    profileMaybeSingleMock.mockResolvedValue({
      data: { role: "respondent", organization_id: "org-1" },
      error: null,
    });
    const { context, error } = await requireAuth(bearerRequest("tok"), ["admin"]);
    expect(context).toBeNull();
    expect(error?.status).toBe(403);
  });

  it("aceita Bearer valido com papel permitido e retorna contexto", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null });
    profileMaybeSingleMock.mockResolvedValue({
      data: { role: "admin", organization_id: null },
      error: null,
    });
    const { context, error } = await requireAuth(bearerRequest("tok"), ["admin"]);
    expect(error).toBeNull();
    expect(context).toEqual({
      userId: VALID_UUID,
      role: "admin",
      organizationId: null,
      mfaVerified: true,
    });
  });


  it("rejeita administrador autenticado sem AAL2", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null });
    bearerAssuranceMock.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { role: "admin", organization_id: null },
      error: null,
    });

    const { context, error } = await requireAuth(bearerRequest("tok"), ["admin"]);

    expect(context).toBeNull();
    expect(error?.status).toBe(403);
  });

  it("retorna 503 quando o perfil não pode ser carregado", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null });
    profileMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const { context, error } = await requireAuth(bearerRequest("tok"), ["admin"]);

    expect(context).toBeNull();
    expect(error?.status).toBe(503);
  });

  it("rejeita (401) Bearer invalido/expirado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    const { context, error } = await requireAuth(bearerRequest("ruim"), ["admin"]);
    expect(context).toBeNull();
    expect(error?.status).toBe(401);
  });

  it("aceita sessao por cookie quando nao ha Bearer", async () => {
    cookieGetUserMock.mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null });
    profileMaybeSingleMock.mockResolvedValue({
      data: { role: "respondent", organization_id: "org-7" },
      error: null,
    });
    const { context, error } = await requireAuth(bearerRequest(null), ["respondent"]);
    expect(error).toBeNull();
    expect(context).toEqual({
      userId: VALID_UUID,
      role: "respondent",
      organizationId: "org-7",
      mfaVerified: false,
    });
  });
});
