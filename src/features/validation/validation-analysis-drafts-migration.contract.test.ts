import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");

function source(name: string): string {
  return fs.readFileSync(path.join(migrationDirectory, name), "utf8");
}

describe("validation analysis drafts na baseline consolidada", () => {
  it("define o schema dos rascunhos na migration canônica de schema", () => {
    const sql = source("20260812000200_schema.sql");
    expect(sql).toContain("create table public.validation_analysis_drafts");
    expect(sql).toContain("validation_analysis_drafts_active_unique");
    expect(sql).toContain("where applied_at is null");
  });

  it("define RPCs na migration canônica de funções", () => {
    const sql = source("20260812000500_functions.sql");
    expect(sql).toContain("save_validation_analysis_draft");
    expect(sql).toContain("mark_validation_analysis_draft_applied");
    expect(sql).toContain("trg_apply_validation_analysis_draft_on_evidence");
    expect(sql).toContain("trg_apply_validation_analysis_draft_on_response");
  });

  it("mantém RLS e grants na migration canônica de segurança", () => {
    const sql = source("20260812000800_security_rls.sql");
    expect(sql).toContain("validation_analysis_drafts");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("save_validation_analysis_draft");
  });

  it("lê o estado do ciclo sem bloqueá-lo no rascunho de validação", () => {
    const sql = source("20260822190000_validation_draft_reads_cycle_state.sql");
    expect(sql).toContain("create or replace function public.save_validation_analysis_draft");
    expect(sql).toMatch(
      /select \* into v_cycle\s+from public\.cycles\s+where id = p_cycle_id;/,
    );
    expect(sql).not.toMatch(/select \* into v_cycle[\s\S]{0,120}for update/i);
    expect(sql).toMatch(
      /select \* into v_response\s+from public\.responses\s+where id = p_response_id\s+and cycle_id = p_cycle_id;/,
    );
    expect(sql).not.toMatch(/select \* into v_response[\s\S]{0,160}for update/i);
  });
});
