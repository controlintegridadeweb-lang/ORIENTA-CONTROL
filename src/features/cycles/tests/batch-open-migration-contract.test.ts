import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function compactSql(): string {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort()
    .map((name) => fs.readFileSync(path.join(dir, name), "utf8"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("migration de abertura de diagnósticos em lote", () => {
  it("mantém a abertura na máquina de estados oficial", () => {
    const sql = compactSql();
    expect(sql).toContain("create or replace function public.create_or_open_cycle");
    expect(sql).toContain("public.commit_cycle_transition");
    expect(sql).toContain("public.replace_cycle_schedule");
    expect(sql).toContain("process_cycles_batch_with_reference");
    expect(sql).toContain("'draft'::public.cycle_state");
    expect(sql).toContain("'in_response'::public.cycle_state");
  });

  it("é idempotente e preserva diagnósticos já iniciados", () => {
    const sql = compactSql();
    expect(sql).toContain("'already_open'");
    expect(sql).toContain("'not_openable'");
    expect(sql).toContain("for update of c");
    expect(sql).toContain("when unique_violation");
  });

  it("impede nova duplicidade entre versões do mesmo formulário", () => {
    const sql = compactSql();
    expect(sql).toContain("cycles_form_period_unique");
    expect(sql).toContain("join public.form_versions fv on fv.id = c.form_version_id");
  });
});
