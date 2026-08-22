import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.join(process.cwd(), "supabase", "migrations");
const canonicalBaselineFiles = [
  "20260812000100_extensions_types.sql",
  "20260812000200_schema.sql",
  "20260812000300_relations.sql",
  "20260812000400_read_models.sql",
  "20260812000500_functions.sql",
  "20260812000600_triggers.sql",
  "20260812000700_storage.sql",
  "20260812000800_security_rls.sql",
  "20260812000900_comments.sql",
  "20260812001000_contract_checks.sql",
] as const;
const deadlineChangeMigration = "20260812001100_action_plan_deadline_change_requests.sql" as const;
const progressMonotonicMigration = "20260820120000_action_plan_progress_monotonic.sql" as const;

type MigrationName =
  | (typeof canonicalBaselineFiles)[number]
  | typeof deadlineChangeMigration
  | typeof progressMonotonicMigration;

function source(name: MigrationName): string {
  return fs.readFileSync(path.join(directory, name), "utf8");
}

function migrationFiles(): string[] {
  return fs.readdirSync(directory).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
}

function allSql(): string {
  return migrationFiles().map((name) => fs.readFileSync(path.join(directory, name), "utf8")).join("\n");
}

describe("migrations ORIENTA", () => {
  it("preserva a baseline de 10 migrations e adiciona evoluções somente depois dela", () => {
    const files = migrationFiles();
    expect(files.slice(0, canonicalBaselineFiles.length)).toEqual([...canonicalBaselineFiles]);
    expect(files).toContain(deadlineChangeMigration);
    expect(files).toContain(progressMonotonicMigration);
    expect(files.indexOf(deadlineChangeMigration)).toBeGreaterThanOrEqual(canonicalBaselineFiles.length);
    expect(files.indexOf(progressMonotonicMigration)).toBeGreaterThan(files.indexOf(deadlineChangeMigration));
    expect(files.join(" ")).not.toMatch(/fix|patch|correction|backfill|marker/i);
  });

  it("mantém a DAG estrutural consolidada da baseline", () => {
    expect(source("20260812000100_extensions_types.sql")).toContain(
      "create schema if not exists extensions",
    );
    expect(source("20260812000100_extensions_types.sql")).toContain(
      "create extension if not exists pgcrypto with schema extensions",
    );
    expect(source("20260812000200_schema.sql")).toContain("create table public.validation_analysis_drafts");
    expect(source("20260812000400_read_models.sql")).toContain("evidence_operational_view");
    expect(source("20260812000500_functions.sql")).toContain("calculate_live_fami_rows");
    expect(source("20260812000600_triggers.sql")).toContain("create trigger");
    expect(source("20260812000700_storage.sql")).toMatch(/storage/i);
    expect(source("20260812000800_security_rls.sql")).toContain("enable row level security");
    expect(source("20260812001000_contract_checks.sql")).toContain(
      "to_regprocedure('public.bootstrap_diagnostico_integridade_2026(uuid)') is not null",
    );
  });

  it("mantém FAMI v7, fila alinhada e rascunhos de análise", () => {
    const sql = allSql().replace(/\s+/g, " ");
    expect(sql).toContain("calculate_live_fami_rows");
    expect(sql).toContain("finalize_validation_cycle");
    expect(sql).toContain("list_validation_queue_page");
    expect(sql).toContain("fami_policy_version in ('v3', 'v4', 'v5', 'v6', 'v7')");
    expect(sql).toContain("admin_proof_status = 'considered_insufficient'");
    expect(sql).toContain("save_validation_analysis_draft");
  });

  it("não reintroduz bootstrap de dados nas migrations de produção", () => {
    expect(allSql()).not.toContain("create or replace function public.bootstrap_diagnostico_integridade_2026");
  });

  it("formaliza alteração de prazo como solicitação administrativa", () => {
    const sql = source(deadlineChangeMigration);
    expect(sql).toContain("create table public.action_plan_deadline_change_requests");
    expect(sql).toContain("create or replace function public.request_action_plan_deadline_change");
    expect(sql).toContain("create or replace function public.decide_action_plan_deadline_change");
    expect(sql).toContain("create or replace function public.guard_action_plan_due_date_change");
    expect(sql).toContain("action_plan_due_date_change_requires_approval");
  });

  it("impede redução do percentual já registrado da ação", () => {
    const sql = source(progressMonotonicMigration);
    expect(sql).toContain("create or replace function public.guard_action_plan_progress_monotonic");
    expect(sql).toContain("action_plan_progress_cannot_decrease");
    expect(sql).toContain("create trigger action_plans_guard_progress_monotonic");
  });
});
