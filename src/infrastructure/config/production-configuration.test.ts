import { describe, expect, it } from "vitest";
import { collectProductionConfigurationIssues } from "./production-configuration";
function validEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://orienta.rn.gov.br",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcxyz.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: `anon_${"a".repeat(40)}`,
    SUPABASE_SERVICE_ROLE_KEY: `service_${"b".repeat(40)}`, CRON_SECRET: "c".repeat(64),
    HEALTHCHECK_SECRET: "h".repeat(64),
  };
}
describe("collectProductionConfigurationIssues", () => {
  it("aceita uma configuração de produção completa", () => expect(collectProductionConfigurationIssues(validEnvironment())).toEqual([]));
  it("rejeita URL insegura, segredo duplicado e variáveis administrativas", () => {
    const env = validEnvironment(); env.NEXT_PUBLIC_APP_URL = "http://localhost:3002"; env.HEALTHCHECK_SECRET = env.CRON_SECRET; env.DATABASE_URL = "postgresql://example";
    const issues = collectProductionConfigurationIssues(env);
    expect(issues).toContainEqual({ key: "NEXT_PUBLIC_APP_URL", code: "insecure_url" });
    expect(issues).toContainEqual({ key: "HEALTHCHECK_SECRET", code: "duplicate_secret" });
    expect(issues).toContainEqual({ key: "DATABASE_URL", code: "forbidden" });
  });
});
