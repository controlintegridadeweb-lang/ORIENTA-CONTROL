import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("contrato de endurecimento de segurança", () => {
  it("exige MFA TOTP e limita a duração das sessões", () => {
    const config = read("supabase/config.toml");
    expect(config).toMatch(/\[auth\.mfa\.totp\][\s\S]*?enroll_enabled = true[\s\S]*?verify_enabled = true/);
    expect(config).toMatch(/\[auth\.sessions\][\s\S]*?timebox = "12h"[\s\S]*?inactivity_timeout = "2h"/);
    expect(config).toContain("secure_password_change = true");
  });

  it("não permite scripts inline sem nonce na CSP", () => {
    const proxy = read("src/infrastructure/supabase/proxy.ts");
    expect(proxy).toContain("'nonce-${nonce}'");
    expect(proxy).toContain("'strict-dynamic'");
    expect(proxy).not.toMatch(/script-src[^\n]*unsafe-inline/);
  });

  it("usa nonce em folhas de estilo e limita inline a atributos necessários", () => {
    const proxy = read("src/infrastructure/supabase/proxy.ts");
    expect(proxy).toContain("style-src 'self' 'nonce-${nonce}'");
    expect(proxy).toContain("style-src-attr 'unsafe-inline'");
    expect(proxy).not.toContain("\"style-src 'self' 'unsafe-inline'\"");
  });

  it("remove a recuperação autônoma de MFA baseada somente em AAL1", () => {
    expect(fs.existsSync(path.join(process.cwd(), "src/app/api/auth/mfa/reset/route.ts"))).toBe(false);
    const form = read("src/features/auth/components/mfa-form.tsx");
    expect(form).not.toContain("/api/auth/mfa/reset");
    expect(form).toContain("responsável técnico autorizado");
  });

  it("protege mutações por cookie contra CSRF", () => {
    const wrapper = read("src/infrastructure/api/with-route.ts");
    const csrf = read("src/infrastructure/security/csrf.ts");
    expect(wrapper).toContain("rejectCrossSiteMutation");
    expect(csrf).toContain('request.headers.get("origin")');
    expect(csrf).toContain('request.headers.get("sec-fetch-site")');
  });

  it("mantém auditoria append-only inclusive para service_role", () => {
    const audit = read("supabase/migrations/20260812000600_triggers.sql");
    const grants = read("supabase/migrations/20260812000800_security_rls.sql");
    expect(audit).toContain("audit_logs_append_only_update_delete");
    expect(audit).toContain("library_audit_events_append_only_truncate");
    expect(grants).toContain(
      "revoke insert, update, delete, truncate on all tables in schema public from authenticated",
    );
    expect(grants).toMatch(/revoke update, delete, truncate on table[\s\S]*public\.audit_logs/);
    const recovery = read("scripts/maintenance/recover-admin-mfa.mjs");
    expect(recovery).toContain("admin_mfa_recovery_failed");
  });

  it("obriga AAL2 para operações administrativas", () => {
    const apiAuth = read("src/infrastructure/api/auth.ts");
    const currentUser = read("src/infrastructure/auth/current-user.ts");
    expect(apiAuth).toContain('profile.role === "admin" && !identity.mfaVerified');
    expect(currentUser).toContain('user.role === "admin" && !user.mfaVerified');
  });

  it("aplica limite persistente padrão às mutações autenticadas", () => {
    const wrapper = read("src/infrastructure/api/with-route.ts");
    expect(wrapper).toContain('["POST", "PUT", "PATCH", "DELETE"]');
    expect(wrapper).toContain("consumeRateLimit");
    expect(wrapper).toContain("Retry-After");
  });
});
