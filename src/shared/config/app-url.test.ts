import { describe, expect, it, vi, afterEach } from "vitest";
import { buildPasswordRecoveryLink, passwordRecoveryRedirectUrl, resolveAppOrigin } from "./app-url";

describe("resolveAppOrigin", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("prefere NEXT_PUBLIC_APP_URL ao Origin do request", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com");
    expect(resolveAppOrigin("https://preview.vercel.app")).toBe("https://prod.example.com");
  });

  it("usa Origin quando APP_URL não está definido", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(resolveAppOrigin("https://preview.vercel.app")).toBe("https://preview.vercel.app");
  });

  it("normaliza barra final de NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com/");
    expect(resolveAppOrigin(null)).toBe("https://prod.example.com");
  });

  it("usa VERCEL_URL como fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "orienta-git-staging-team.vercel.app");
    expect(resolveAppOrigin(undefined)).toBe("https://orienta-git-staging-team.vercel.app");
  });

  it("cai em localhost sem configuracao", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_BRANCH_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(resolveAppOrigin(null)).toBe("http://localhost:3002");
  });
});

describe("passwordRecoveryRedirectUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("aponta para /auth/update-password no origin canônico", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com");
    expect(passwordRecoveryRedirectUrl()).toBe("https://prod.example.com/auth/update-password");
  });
});

describe("buildPasswordRecoveryLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("monta URL do app com token_hash para verifyOtp (PKCE)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://prod.example.com");
    expect(buildPasswordRecoveryLink("abc123")).toBe(
      "https://prod.example.com/auth/update-password?token_hash=abc123&type=recovery",
    );
  });
});
