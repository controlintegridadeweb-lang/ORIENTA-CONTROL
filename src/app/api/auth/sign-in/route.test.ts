import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  assurance: vi.fn(),
  profile: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/infrastructure/security/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("@/infrastructure/observability/logger", () => ({
  logError: mocks.logError,
}));
vi.mock("@/infrastructure/supabase/auth-server", () => ({
  createSupabaseServerActionClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      mfa: { getAuthenticatorAssuranceLevel: mocks.assurance },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.profile }),
      }),
    }),
  }),
}));

import { POST } from "./route";

function request(
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request("https://orienta.example/api/auth/sign-in", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://orienta.example",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://orienta.example";
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 0,
    });
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
      error: null,
    });
    mocks.profile.mockResolvedValue({ data: { role: "respondent" }, error: null });
    mocks.assurance.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("rejeita origem cross-site antes de consultar credenciais", async () => {
    const response = await POST(
      request(
        { email: "user@example.com", password: "secret" },
        { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("aplica limite persistente por conta e rede", async () => {
    mocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 })
      .mockResolvedValueOnce({ allowed: true, remaining: 20, retryAfterSeconds: 0 });

    const response = await POST(
      request({ email: "user@example.com", password: "secret" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("não revela detalhes de credenciais inválidas", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "user not found" },
    });

    const response = await POST(
      request({ email: "unknown@example.com", password: "secret" }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "E-mail ou senha inválidos." });
  });

  it("exige etapa MFA após autenticar um administrador em AAL1", async () => {
    mocks.profile.mockResolvedValue({ data: { role: "admin" }, error: null });
    mocks.assurance.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });

    const response = await POST(
      request({ email: "admin@example.com", password: "secret" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: "admin", requiresMfa: true });
  });

  it("conclui o login do respondente sem exigir MFA administrativo", async () => {
    const response = await POST(
      request({ email: "respondent@example.com", password: "secret" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ role: "respondent", requiresMfa: false });
  });
});
