import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260826120000_bimonthly_tracking_and_prelim_v2.sql"),
  "utf8",
)
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("contrato do acompanhamento bimestral e prelim_v2", () => {
  it("grava novos FAMI preliminares em prelim_v2 sem alterar o FAMI oficial", () => {
    expect(sql).toContain("'prelim_v2'");
    expect(sql).toContain("methodology_version in ('prelim_v1', 'prelim_v2')");
    expect(sql).not.toContain("update public.fami_results");
    expect(sql).not.toContain("delete from public.fami_results");
  });

  it("reconstrói o estado das ações na data de corte", () => {
    expect(sql).toContain("create or replace function public.cycle_action_states_at(");
    expect(sql).toContain("u.created_at < p_cutoff_exclusive");
    expect(sql).toContain("n.created_at < p_cutoff_exclusive");
    expect(sql).toContain("n.resolved_at is null or n.resolved_at >= p_cutoff_exclusive");
    expect(sql).toContain("from public.cycle_action_states_at(");
  });

  it("isola o relatório bimestral em tabelas imutáveis e com rls", () => {
    expect(sql).toContain("create table public.action_plan_bimonthly_reports");
    expect(sql).toContain("create table public.action_plan_bimonthly_action_snapshots");
    expect(sql).toContain("create table public.action_plan_bimonthly_criterion_snapshots");
    expect(sql).toContain("execute function public.block_mutation()");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("app_private.current_organization_id()");
    expect(sql).toContain("close_due_action_plan_bimesters");
    expect(sql).toContain("materialize_action_plan_bimonthly_report");
  });

  it("fecha o bimestre 2/4/6 e também materializa o FAMI preliminar correspondente", () => {
    expect(sql).toContain("public.materialize_fami_preliminary(");
    expect(sql).toContain("v_quadrimester");
  });
});
