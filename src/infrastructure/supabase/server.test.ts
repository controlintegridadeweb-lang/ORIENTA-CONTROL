import { afterEach, describe, expect, it, vi } from "vitest";

const envKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const previousEnv = envKeys.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

function clearEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

describe("supabase server clients", () => {
  afterEach(() => {
    clearEnv();
    for (const key of envKeys) {
      const value = previousEnv[key];
      if (value) process.env[key] = value;
    }
    vi.resetModules();
  });

  it("falha quando faltam variaveis para service role", async () => {
    clearEnv();
    const { createSupabaseServiceRoleClient } = await import("./server");
    expect(() => createSupabaseServiceRoleClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("falha quando faltam variaveis para client de usuario", async () => {
    clearEnv();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const { createSupabaseUserClient } = await import("./server");
    expect(() => createSupabaseUserClient("token")).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
