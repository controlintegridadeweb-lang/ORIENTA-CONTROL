import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function compactSql(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

describe("partial reopen migration contract", () => {
  it("define escopo parcial, guarda no workbench e lote de validação", () => {
    const migration = compactSql();
    expect(migration).toContain("cycle_reopen_allowed_questions");
    expect(migration).toContain("app_private.is_cycle_question_collection_editable");
    expect(migration).not.toMatch(
      /create or replace function public\.is_cycle_question_collection_editable/,
    );
    expect(migration).toContain("p_question_version_ids");
    expect(migration).toContain("question_not_in_reopen_scope");
    expect(migration).toContain("admin_reopen_validation_cycles");
    expect(migration).toContain("reopen_validation_cycle");
  });
});
