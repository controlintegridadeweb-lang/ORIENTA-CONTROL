import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migration = [
  "20260812000200_schema.sql",
  "20260812000500_functions.sql",
  "20260812000600_triggers.sql",
  "20260813000100_fami_preliminary_open_period_and_close.sql",
]
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("contrato do FAMI preliminar quadrimestral", () => {
  it("mantém armazenamento separado do FAMI oficial", () => {
    expect(migration).toContain("create table public.fami_preliminary_processings");
    expect(migration).toContain("create table public.fami_preliminary_results");
    expect(migration).not.toContain("update public.fami_results");
    expect(migration).not.toContain("delete from public.fami_results");
  });

  it("versiona cada checkpoint sem sobrescrever histórico", () => {
    expect(migration).toContain("unique (cycle_id, reference_year, quadrimester, calculation_version)");
    expect(migration).toContain("fami_preliminary_processings_immutable");
    expect(migration).toContain("coalesce(max(fp.calculation_version), 0) + 1");
  });

  it("reconstrói ações na data de corte e exclui canceladas da média", () => {
    expect(migration).toContain("u.created_at < v_cutoff_exclusive");
    expect(migration).toContain("filter (where s.status <> 'cancelled'::public.action_plan_status)");
  });

  it("exceção aprovada não gera recuperação e aceite não entra na fórmula", () => {
    expect(migration).toContain("ex.status = 'approved'");
    expect(migration).toContain("when ex.id is not null then 0::numeric");
  });

  it("permite prévia manual no período aberto e fecha automaticamente no corte", () => {
    expect(migration).toContain("when v_kind = 'manual' then current_timestamp");
    expect(migration).toContain("preliminary_period_already_closed");
    expect(migration).toContain("calculation_kind");
    expect(migration).toContain("closed_at");
    expect(migration).toContain("close_due_fami_preliminary_quadrimesters");
    expect(migration).toContain("fami_preliminary_processings_closed_unique");
    expect(migration).toContain("p_actor_user_id is null");
  });

  it("usa o processamento oficial disponível até o limite do cálculo", () => {
    expect(migration).toContain("fr.created_at < v_cutoff_exclusive");
    expect(migration).toContain("cp.status = 'completed'::public.cycle_processing_status");
    expect(migration).toContain("preliminary_source_fami_not_available_for_period");
  });

  it("aborta se a reconstrução por critério divergir do FAMI oficial congelado", () => {
    expect(migration).toContain("preliminary_official_reconstruction_mismatch");
    expect(migration).toContain("v_reconstructed_official - v_source_global.points_obtained");
    expect(migration).toContain("v_reconstructed_possible - v_source_global.points_possible");
  });

  it("fixa os períodos civis no próprio schema", () => {
    expect(migration).toContain("quadrimester = 1 and period_start = make_date(reference_year, 1, 1)");
    expect(migration).toContain("quadrimester = 2 and period_start = make_date(reference_year, 5, 1)");
    expect(migration).toContain("quadrimester = 3 and period_start = make_date(reference_year, 9, 1)");
  });
});
