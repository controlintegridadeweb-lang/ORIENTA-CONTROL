import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

function readTomlSection(config: string, sectionName: string): string {
  const header = `[${sectionName}]`;
  const sectionStart = config.indexOf(header);

  if (sectionStart < 0) {
    return "";
  }

  const contentStart = sectionStart + header.length;
  const remainingConfig = config.slice(contentStart);
  const nextSectionOffset = remainingConfig.search(/^\[[^\]]+\]\s*$/m);

  return nextSectionOffset < 0
    ? remainingConfig
    : remainingConfig.slice(0, nextSectionOffset);
}

describe("contrato local do Supabase Auth", () => {
  it("alinha NEXT_PUBLIC_APP_URL, Site URL e recuperação de senha", () => {
    const envExample = readProjectFile(".env.example");
    const config = readProjectFile("supabase", "config.toml");

    const appUrl = envExample.match(/^NEXT_PUBLIC_APP_URL=(.+)$/m)?.[1];
    const siteUrl = config.match(/^site_url\s*=\s*"([^"]+)"$/m)?.[1];

    expect(appUrl).toBe("http://localhost:3002");
    expect(siteUrl).toBe(appUrl);
    expect(config).toContain(`"${appUrl}/auth/update-password"`);
    expect(config).toContain('"http://127.0.0.1:3002/auth/update-password"');
    expect(config).not.toContain('"https://127.0.0.1:3000"');
    expect(config).toContain("[local_smtp]");
    expect(config).not.toContain("[inbucket]");
  });

  it("mantém invite-only: sem signup público, com provider de e-mail ativo para login", () => {
    const config = readProjectFile("supabase", "config.toml");
    const authSection = readTomlSection(config, "auth");
    const emailSection = readTomlSection(config, "auth.email");
    const smsSection = readTomlSection(config, "auth.sms");

    // [auth].enable_signup → GOTRUE_DISABLE_SIGNUP (bloqueia cadastro público).
    expect(authSection).toMatch(/^enable_signup\s*=\s*false$/m);
    // [auth.email].enable_signup → liga o provider de e-mail (necessário p/ sign-in).
    expect(emailSection).toMatch(/^enable_signup\s*=\s*true$/m);
    // SMS não é usado na plataforma.
    expect(smsSection).toMatch(/^enable_signup\s*=\s*false$/m);
  });
});

