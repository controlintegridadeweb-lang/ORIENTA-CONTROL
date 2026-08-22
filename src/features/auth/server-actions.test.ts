import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  consumeRateLimit: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/infrastructure/security/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("@/infrastructure/observability/logger", () => ({
  logError: mocks.logError,
}));
vi.mock("@/infrastructure/supabase/auth-server", () => ({
  createSupabaseServerActionClient: vi.fn().mockResolvedValue({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      signOut: mocks.signOut,
    },
  }),
}));

import { requestPasswordResetAction } from "./server-actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://orienta.example";
    mocks.headers.mockResolvedValue(
      new Headers({
        origin: "https://orienta.example",
        "x-forwarded-for": "203.0.113.10",
      }),
    );
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("aplica limites por conta e por rede antes de enviar o link", async () => {
    const result = await requestPasswordResetAction(
      { status: "idle" },
      form("User@Example.com"),
    );

    expect(result.status).toBe("success");
    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "User@Example.com",
      { redirectTo: "https://orienta.example/auth/update-password" },
    );
  });

  it("falha fechado quando o limite é excedido", async () => {
    mocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 300 })
      .mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterSeconds: 0 });

    const result = await requestPasswordResetAction(
      { status: "idle" },
      form("user@example.com"),
    );

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("falha fechado quando o armazenamento do rate limit está indisponível", async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error("database unavailable"));

    const result = await requestPasswordResetAction(
      { status: "idle" },
      form("user@example.com"),
    );

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalled();
  });
});
