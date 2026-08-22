import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function baseline(): string {
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

describe("operações em lote e performance na base canônica", () => {
  const sql = baseline();

  it("expõe RPCs de lote sobre a mesma regra individual", () => {
    expect(sql).toContain("function public.create_cycles_batch");
    expect(sql).toContain("function public.create_or_open_cycles_batch");
    expect(sql).toContain("public.create_cycle(");
    expect(sql).toContain("public.create_or_open_cycle(");
  });

  it("isola falhas por organização e mantém relatório parcial", () => {
    expect(sql).toContain("when others then");
    expect(sql).toContain("'status', 'failed'");
    expect(sql).toContain("'organization_id', v_organization_id");
  });

  it("reordena perguntas do rascunho em uma única instrução validada", () => {
    expect(sql).toContain("function public.reorder_form_draft_questions");
    expect(sql).toContain("with ordinality");
    expect(sql).toContain("form_draft_question_order_mismatch");
    expect(sql).toContain("set order_index = ordered.ordinality - 1");
  });

  it("declara índices nas migrations que criam as tabelas", () => {
    expect(sql).toContain("cycles_org_state_period_idx");
    expect(sql).toContain("evidences_active_validation_submitted_idx");
    expect(sql).toContain("where deactivated_at is null");
  });
});
