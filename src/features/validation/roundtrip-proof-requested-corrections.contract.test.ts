import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function canonicalSql(): string {
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  return [
    "20260812000500_functions.sql",
    "20260812000900_comments.sql",
  ]
    .map((name) => fs.readFileSync(path.join(migrationsDir, name), "utf8"))
    .join("\n");
}

function compact(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("roundtrip proof_requested — contrato canônico", () => {
  it("remove o clear antecipado de proof_requested no upload", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("create or replace function public.apply_workbench_response(");
    expect(sql).toContain("proof_requested só é limpo no reenvio do ciclo.");
    expect(sql).not.toContain(
      "update public.responses set admin_proof_status = null, admin_proof_observation = null, admin_proof_decided_by = null, admin_proof_decided_at = null where id = v_response_id and admin_proof_status = 'proof_requested';",
    );
  });

  it("permite remover evidência pendente em comprovação ausente", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("or v_response.admin_proof_status = 'proof_requested'");
    expect(sql).toContain("create or replace function public.remove_workbench_evidence_item(");
  });

  it("só bloqueia consolidação por comprovação ausente sem evidência ativa", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain(
      "and exists ( select 1 from public.evidences e where e.response_id = responses.id and e.deactivated_at is null )",
    );
    expect(sql).toContain(
      "and not exists ( select 1 from public.evidences e where e.response_id = resp.id and e.deactivated_at is null )",
    );
  });

  it("marca rascunho absent_proof ao limpar admin_proof_status", () => {
    const sql = compact(canonicalSql());
    expect(sql).toContain("if old.admin_proof_status is distinct from new.admin_proof_status");
    expect(sql).toContain(
      "and ( new.admin_proof_status is not null or old.admin_proof_status is not null )",
    );
    expect(sql).toContain(
      "perform public.mark_validation_analysis_draft_applied( new.cycle_id, 'absent_proof', null, new.id );",
    );
  });
});
