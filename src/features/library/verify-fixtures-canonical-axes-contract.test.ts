import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const verifyDir = resolve(process.cwd(), "supabase", "verify");
const seedPath = join(verifyDir, "_seed_minimal.sql");

function verifySqlFiles(): string[] {
  return readdirSync(verifyDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => join(verifyDir, name));
}

describe("fixtures de integração usam eixos canônicos", () => {
  it("garante Governanca, Ambiental e Social por nome, sem UUID paralelo", () => {
    const seed = readFileSync(seedPath, "utf8");
    expect(seed).toContain("insert into public.axes (name) values");
    expect(seed).toContain("'Governanca'");
    expect(seed).toContain("'Ambiental'");
    expect(seed).toContain("'Social'");
    expect(seed).toContain("on conflict (name) do nothing");
    expect(seed).toContain("where axes.name = 'Governanca'");
    expect(seed).not.toMatch(/insert into public\.axes\s*\(\s*id/i);
    expect(seed).not.toContain("00000000-0000-0000-0000-0000000000c1");
    expect(seed).not.toContain("session_replication_role");
  });

  it("publica a versão do formulário seed só depois da atribuição", () => {
    const seed = readFileSync(seedPath, "utf8");
    const assignmentAt = seed.indexOf("insert into public.form_assignments");
    const versionAt = seed.indexOf("insert into public.form_versions");
    expect(assignmentAt).toBeGreaterThan(0);
    expect(versionAt).toBeGreaterThan(assignmentAt);
  });

  it("não insere action_plans com eixo inventado", () => {
    for (const file of verifySqlFiles()) {
      const sql = readFileSync(file, "utf8");
      expect(sql, file).not.toContain("00000000-0000-0000-0000-0000000000c1");
      expect(sql, file).not.toContain("00000000-0000-0000-0000-0000000000c2");
      expect(sql, file).not.toContain("00000000-0000-0000-0000-0000000000c3");
    }
  });
});
