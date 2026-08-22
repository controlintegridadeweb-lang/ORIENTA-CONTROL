import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// requireAuth e mockado para testar o wrapper isoladamente.
const requireAuthMock = vi.fn();
vi.mock("@/infrastructure/api/auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/infrastructure/observability/logger", () => ({
  logError: vi.fn(),
}));
const consumeRateLimitMock = vi.fn();
vi.mock("@/infrastructure/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

import { withRoute, requireUuid } from "./with-route";
import { DomainNotFoundError } from "./domain-errors";

const okAuth = {
  context: { userId: "u1", role: "admin", organizationId: null, mfaVerified: true },
  error: null,
};

function makeReq(
  url = "https://x.test/api/y",
  method = "GET",
  extraHeaders: Record<string, string> = {},
) {
  const headers = new Headers(extraHeaders);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    if (!headers.has("origin")) headers.set("origin", new URL(url).origin);
    if (!headers.has("sec-fetch-site")) headers.set("sec-fetch-site", "same-origin");
  }
  return new Request(url, { method, headers });
}

describe("withRoute", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    consumeRateLimitMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 89,
      retryAfterSeconds: 0,
    });
  });


  it("rejeita mutação cross-site antes da autenticação", async () => {
    const handler = vi.fn();
    const route = withRoute({ roles: ["admin"], route: "/api/y" }, handler);

    const res = await route(
      makeReq("https://x.test/api/y", "POST", {
        origin: "https://attacker.test",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(res.status).toBe(403);
    expect(requireAuthMock).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("retorna o early-return de auth sem chamar o handler", async () => {
    const authFail = NextResponse.json({ error: "nope" }, { status: 401 });
    requireAuthMock.mockResolvedValue({ context: null, error: authFail });
    const handler = vi.fn();
    const route = withRoute({ roles: ["admin"], route: "/api/y" }, handler);

    const res = await route(makeReq());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passa auth e params resolvidos ao handler", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    const route = withRoute<{ formId: string }>(
      { roles: ["admin"], route: "/api/y/[formId]" },
      async ({ auth, params }) =>
        NextResponse.json({ role: auth.role, formId: params.formId }),
    );

    const res = await route(makeReq(), { params: Promise.resolve({ formId: "abc" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "admin", formId: "abc" });
  });


  it("aplica rate limit persistente nas mutações", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    consumeRateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 37,
    });
    const handler = vi.fn();
    const route = withRoute({ roles: ["admin"], route: "/api/y" }, handler);

    const res = await route(makeReq("https://x.test/api/y", "POST"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("37");
    expect(handler).not.toHaveBeenCalled();
    expect(consumeRateLimitMock).toHaveBeenCalledWith({
      scope: "api:POST:/api/y",
      subject: "u1",
      limit: 90,
      windowSeconds: 300,
    });
  });

  it("permite desativar o limite padrão em rota com política própria", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    const route = withRoute(
      { roles: ["admin"], route: "/api/y", mutationRateLimit: false },
      async () => NextResponse.json({ ok: true }),
    );

    const res = await route(makeReq("https://x.test/api/y", "POST"));

    expect(res.status).toBe(200);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
  });

  it("converte erro de dominio lancado no handler em status correto", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    const route = withRoute({ roles: ["admin"], route: "/api/y" }, async () => {
      throw new DomainNotFoundError("sumiu");
    });

    const res = await route(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "sumiu" });
  });

  it("preserva mensagem pública específica no fallback 500", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    const route = withRoute(
      {
        roles: ["admin"],
        route: "/api/y",
        internalErrorMessage: "Falha controlada.",
      },
      async () => {
        throw new Error("detalhe interno");
      },
    );

    const res = await route(makeReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      error: "Falha controlada.",
      errorId: expect.any(String),
    });
  });

  it("aplica extraErrorHandlers antes do fallback generico", async () => {
    requireAuthMock.mockResolvedValue(okAuth);
    class CustomError extends Error {}
    const route = withRoute(
      {
        roles: ["admin"],
        route: "/api/y",
        extraErrorHandlers: [
          (e) =>
            e instanceof CustomError
              ? NextResponse.json({ error: "custom" }, { status: 418 })
              : null,
        ],
      },
      async () => {
        throw new CustomError();
      },
    );

    const res = await route(makeReq());
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ error: "custom" });
  });
});

describe("requireUuid", () => {
  it("retorna o valor quando UUID valido", () => {
    const v = "123e4567-e89b-12d3-a456-426614174000";
    expect(requireUuid(v, "formId")).toBe(v);
  });

  it("lanca DomainValidationError (400) quando invalido", () => {
    expect(() => requireUuid("nope", "formId")).toThrowError(/formId inválido/);
  });
});
