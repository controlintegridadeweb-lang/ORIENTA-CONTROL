import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

function allSql(): string {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function finalizationSql(): string {
  const sql = allSql();
  const start = sql.lastIndexOf(
    "create or replace function public.finalize_validation_cycle(",
  );
  const end = sql.indexOf(
    "comment on function public.finalize_validation_cycle",
    start,
  );
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("finalização canônica do FAMI na validação", () => {
  it("calcula o resultado no banco e não aceita FAMI preparado pelo cliente", () => {
    const sql = finalizationSql();
    expect(sql).toContain("p_cycle_id uuid, p_actor_user_id uuid");
    expect(sql).not.toContain("p_desired_recs");
    expect(sql).not.toContain("p_fami_rows");
    expect(sql).toContain("from public.calculate_live_fami_rows(p_cycle_id)");
  });

  it("materializa recomendações, snapshots e FAMI antes de validar", () => {
    const sql = finalizationSql();
    const recommendationIndex = sql.indexOf("insert into public.recommendations");
    const responseSnapshotIndex = sql.indexOf("insert into public.response_snapshots");
    const evidenceSnapshotIndex = sql.indexOf("insert into public.evidence_snapshots");
    const waiverSnapshotIndex = sql.indexOf(
      "insert into public.processing_waiver_snapshots",
    );
    const famiIndex = sql.indexOf("insert into public.fami_results");
    const processingIndex = sql.indexOf(
      "set status = 'completed'::public.cycle_processing_status",
    );
    const validationIndex = sql.indexOf(
      "set state = 'validated'::public.cycle_state",
    );

    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(responseSnapshotIndex).toBeGreaterThan(recommendationIndex);
    expect(evidenceSnapshotIndex).toBeGreaterThan(responseSnapshotIndex);
    expect(waiverSnapshotIndex).toBeGreaterThan(evidenceSnapshotIndex);
    expect(famiIndex).toBeGreaterThan(waiverSnapshotIndex);
    expect(processingIndex).toBeGreaterThan(famiIndex);
    expect(validationIndex).toBeGreaterThan(processingIndex);
  });

  it("usa pesos v7 e normaliza percentual", () => {
    const sql = allSql();
    expect(sql).toContain(
      "else round((points_obtained / points_possible) * 100, 2) end as percentage",
    );
    expect(sql).toContain("when not requires_evidence then 1::numeric");
    expect(sql).toContain("when has_approved_evidence then 2::numeric");
    expect(sql).toContain("fami_policy_version = 'v7'");
    expect(sql).toContain("validation_unresolved_evidence");
    expect(sql).toContain("validation_unresolved_absent_proof");
  });

  it("mantém ordem de lock ciclo → resposta", () => {
    const finalization = finalizationSql();
    const sql = allSql();
    expect(
      finalization.indexOf("from public.cycles where id = p_cycle_id for update"),
    ).toBeLessThan(
      finalization.indexOf(
        "from public.responses resp where resp.cycle_id = p_cycle_id for update",
      ),
    );
    expect(sql).toContain(
      "mantém a mesma ordem de lock da consolidação: ciclo → resposta",
    );
  });
});
