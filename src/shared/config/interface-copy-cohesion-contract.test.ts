import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

describe("contrato de coesão da linguagem visível", () => {
  it("mantém o termo oficial Plano de ação e elimina o rótulo técnico anterior", () => {
    const source = collectFiles(path.join(process.cwd(), "src"))
      .filter(
        (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
      )
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toContain("Plano de Ação");
    expect(source).not.toContain("Planos de Ação");
    expect(source).not.toContain("Score FAMI");
  });

  it("mantém o inventário da auditoria sincronizado com o App Router", () => {
    const root = process.cwd();
    const appFiles = collectFiles(path.join(root, "src", "app")).map((file) =>
      file.split(path.sep).join("/"),
    );
    const sourceFiles = collectFiles(path.join(root, "src")).map((file) =>
      file.split(path.sep).join("/"),
    );
    const pageCount = appFiles.filter((file) => /\/page\.(ts|tsx)$/.test(file)).length;
    const apiRouteCount = appFiles.filter((file) => /\/api\/.*\/route\.ts$/.test(file)).length;
    const testFileCount = sourceFiles.filter((file) => /\.test\.(ts|tsx)$/.test(file)).length;
    const audit = fs.readFileSync(
      path.join(root, "docs", "current", "ARQUITETURA.md"),
      "utf8",
    );

    expect(audit).toContain(`**${pageCount} páginas**`);
    expect(audit).toContain(`**${apiRouteCount} rotas de API**`);
    expect(audit).toContain(`Vitest | **${testFileCount} arquivos**`);
  });
});
