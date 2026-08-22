import { describe, expect, it } from "vitest";
import {
  buildVercelRuntimeEnv,
  listPresentLocalOnlyKeys,
  validateProductionEnv,
} from "./env-contract.mjs";

const validRuntime = {
  NEXT_PUBLIC_APP_URL: "https://orienta.cge.rn.gov.br",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(40),
  CRON_SECRET: "c".repeat(64),
  HEALTHCHECK_SECRET: "d".repeat(64),
};

describe("contrato de env da Vercel", () => {
  it("aprova o conjunto mínimo de runtime", () => {
    expect(validateProductionEnv(validRuntime)).toEqual([]);
  });

  it("rejeita localhost em NEXT_PUBLIC_APP_URL", () => {
    const issues = validateProductionEnv({
      ...validRuntime,
      NEXT_PUBLIC_APP_URL: "http://localhost:3002",
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        { key: "NEXT_PUBLIC_APP_URL", code: "insecure_url" },
        { key: "NEXT_PUBLIC_APP_URL", code: "placeholder" },
      ]),
    );
  });

  it("rejeita credenciais administrativas no runtime", () => {
    const issues = validateProductionEnv({
      ...validRuntime,
      SUPABASE_ACCESS_TOKEN: "sbp_test",
      SUPABASE_DB_URL: "postgresql://postgres:secret@db.example:5432/postgres",
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        { key: "SUPABASE_ACCESS_TOKEN", code: "forbidden_in_runtime" },
        { key: "SUPABASE_DB_URL", code: "forbidden_in_runtime" },
      ]),
    );
  });

  it("monta o runtime a partir do .env.local sem copiar chaves locais", () => {
    const runtime = buildVercelRuntimeEnv({
      NEXT_PUBLIC_APP_URL: "http://localhost:3002",
      NEXT_PUBLIC_SUPABASE_URL: validRuntime.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: validRuntime.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: validRuntime.SUPABASE_SERVICE_ROLE_KEY,
      CRON_SECRET: validRuntime.CRON_SECRET,
      HEALTHCHECK_SECRET: validRuntime.HEALTHCHECK_SECRET,
      PRODUCTION_BASE_URL: "https://orienta.cge.rn.gov.br",
      SUPABASE_ACCESS_TOKEN: "sbp_nao_enviar",
      SUPABASE_DB_URL: "postgresql://nao-enviar",
    });

    expect(runtime.NEXT_PUBLIC_APP_URL).toBe("https://orienta.cge.rn.gov.br");
    expect(runtime).not.toHaveProperty("SUPABASE_ACCESS_TOKEN");
    expect(runtime).not.toHaveProperty("SUPABASE_DB_URL");
    expect(validateProductionEnv(runtime)).toEqual([]);
  });

  it("lista apenas chaves locais presentes", () => {
    expect(
      listPresentLocalOnlyKeys({
        SUPABASE_ACCESS_TOKEN: "sbp_presente",
        PRODUCTION_BASE_URL: "",
      }),
    ).toEqual(["SUPABASE_ACCESS_TOKEN"]);
  });
});
