import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hostOnlyCookieOptions } from "./session-cookies";

describe("hostOnlyCookieOptions", () => {
  it("remove Domain e preserva as demais opções de segurança", () => {
    expect(
      hostOnlyCookieOptions({
        domain: ".example.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax" as const,
      }),
    ).toEqual({
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  });

  it("não altera opções que já são host-only", () => {
    expect(
      hostOnlyCookieOptions({
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "strict" as const,
      }),
    ).toEqual({
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
  });

  it("é aplicado nos clientes de sessão do Supabase", () => {
    const authServer = fs.readFileSync(path.join(process.cwd(), "src/infrastructure/supabase/auth-server.ts"), "utf8");
    const proxy = fs.readFileSync(path.join(process.cwd(), "src/infrastructure/supabase/proxy.ts"), "utf8");
    expect(authServer).toContain("hostOnlyCookieOptions(options)");
    expect(proxy).toContain("hostOnlyCookieOptions(options)");
    expect(authServer).not.toMatch(/domain:\s*["']\./);
    expect(proxy).not.toMatch(/domain:\s*["']\./);
  });
});
