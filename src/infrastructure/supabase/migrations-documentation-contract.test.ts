import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");

function migrationFiles(): string[] {
  return fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /^\d{14}_.+\.sql$/.test(file))
    .sort();
}

function readProjectFile(...segments: string[]): string {
  return fs.readFileSync(path.join(projectRoot, ...segments), "utf8");
}

describe("contrato da documentação de migrations", () => {
  it("mantém a quantidade e o intervalo documentados alinhados aos arquivos canônicos", () => {
    const files = migrationFiles();
    const firstNumber = files.at(0)?.slice(0, 14);
    const lastNumber = files.at(-1)?.slice(0, 14);

    expect(files).not.toHaveLength(0);
    expect(new Set(files.map((file) => file.slice(0, 14))).size).toBe(files.length);

    const readme = readProjectFile("README.md");
    const migrationsReadme = readProjectFile("supabase", "migrations", "README.md");
    const canonicalDoc = readProjectFile("docs", "current", "BANCO.md");

    expect(readme).toContain(`${files.length} migrations timestampadas`);
    expect(migrationsReadme).toContain(`**${files.length} migrations SQL timestampadas**`);
    expect(migrationsReadme).toContain(`\`${firstNumber}\` a \`${lastNumber}\``);
    expect(canonicalDoc).toContain(`Aplicar as ${files.length} migrations em banco vazio`);
    expect(canonicalDoc.replace(/\s+/g, " ")).toContain(
      `\`${firstNumber}\` a \`${lastNumber}\``,
    );
  });

  it("documenta cada migration canônica no inventário específico", () => {
    const migrationsReadme = readProjectFile("supabase", "migrations", "README.md");

    for (const file of migrationFiles()) {
      expect(migrationsReadme).toContain(`\`${file}\``);
    }
  });
});
