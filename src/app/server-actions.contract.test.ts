import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const actionFiles = [
    "src/features/auth/server-actions.ts",
  "src/app/admin/organizacoes/actions.ts",
  "src/app/admin/usuarios/actions.ts",
] as const;

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("contrato das Server Actions", () => {
  it.each(actionFiles)("%s valida FormData com schema explícito", (path) => {
    const content = source(path);
    expect(content).toMatch(/safeParse\s*\(/);
    expect(content).not.toMatch(/String\s*\(\s*formData\.get/);
    expect(content).not.toMatch(/Number\s*\(\s*formData\.get/);
    expect(content).not.toMatch(/Boolean\s*\(\s*formData\.get/);
  });

  it("mantém autorização backend nas ações administrativas", () => {
    for (const path of actionFiles.filter((item) => item.includes("/admin/"))) {
      expect(source(path), path).toContain('requireRole(["admin"])');
    }
  });
});
