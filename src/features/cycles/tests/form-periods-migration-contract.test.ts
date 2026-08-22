import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function canonicalSql(): string {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  return [
    "20260812000200_schema.sql",
    "20260812000300_relations.sql",
    "20260812000500_functions.sql",
  ]
    .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
    .join("\n");
}

function compact(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("form_periods — contrato canônico", () => {
  it("cria form_periods com identidade por period_code", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("create table public.form_periods");
    expect(sql).toContain(
      "constraint form_periods_code_unique unique (form_version_id, period_code)",
    );
    expect(sql).not.toContain("create table if not exists public.form_periods");
  });

  it("torna period_id a identidade do ciclo", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("period_id uuid not null");
    expect(sql).toContain("cycles_period_id_fkey");
    expect(sql).toContain("cycles_period_org_unique");
    expect(sql).not.toContain("drop constraint if exists cycles_identity_unique");
  });

  it("identifica o período pelo period_code, sem backfill histórico de rótulos", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("fp.period_code = v_code");
    expect(sql).toContain("fp.period_code = v_period.period_code");
    expect(sql).not.toContain("form_periods_unification_abort");
  });

  it("atualiza create_cycle para period_id via ensure_form_period", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("create or replace function public.create_cycle");
    expect(sql).toContain("v_period := public.ensure_form_period");
    expect(sql).toContain("cycles_form_period_unique");
    expect(sql).toContain("period_id, period_label");
  });

  it("fixtures de verify preenchem period_id em todo insert de ciclo", () => {
    const verifyDir = path.join(process.cwd(), "supabase", "verify");
    const files = fs.readdirSync(verifyDir).filter((name) => name.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(verifyDir, file), "utf8");
      const inserts = [...sql.matchAll(/insert into public\.cycles\s*\(([^)]+)\)/gi)];
      if (inserts.length === 0) continue;

      expect(sql, `${file} precisa resolver period_id via ensure_form_period`).toContain(
        "ensure_form_period",
      );
      for (const insert of inserts) {
        const columns = insert[1].replace(/\s+/g, " ").toLowerCase();
        expect(columns, `${file} omite period_id no insert de cycles`).toContain("period_id");
      }
    }
  });
});
