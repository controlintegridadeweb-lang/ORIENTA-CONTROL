import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase", "migrations");

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_.+\.sql$/.test(name))
    .sort();
}

function lastFunctionBody(functionName: string): string {
  const needle = `create or replace function public.${functionName}`;
  let body = "";
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const start = sql.toLowerCase().indexOf(needle.toLowerCase());
    if (start < 0) continue;
    body = sql.slice(start);
  }
  expect(body.length, `${functionName} ausente`).toBeGreaterThan(0);
  return body.replace(/\s+/g, " ");
}

describe("reparo da carga 2026 para FAMI manual", () => {
  it("exige FAMI oficial só na reabertura verdadeira", () => {
    const trigger = lastFunctionBody("enforce_cycle_transition_integrity()");
    expect(trigger).toContain("public.cycle_has_official_fami(new.id)");
    expect(trigger).toContain("validation_reopen_requires_official_workflow");
    expect(trigger).toContain("validation_requires_finalized_fami_processing");
    expect(trigger).toContain(
      "coalesce(resp.admin_applicability_status, '') <> 'not_applicable'",
    );
  });

  it("não exige evento de reabertura quando não há FAMI oficial", () => {
    const metadata = lastFunctionBody("enforce_validation_reopen_metadata()");
    expect(metadata).toContain("public.cycle_has_official_fami(new.id)");
    expect(metadata).toContain("validation_reopen_requires_reason_and_event");
  });

  it("recompõe processing, prazo do período e remove finalização automática", () => {
    const repair = lastFunctionBody("repair_cycles_for_manual_fami(");
    expect(repair).toContain("global_admin_required");
    expect(repair).toContain("insert into public.cycle_processings");
    expect(repair).toContain("'working'::public.cycle_processing_status");
    expect(repair).toContain("state = 'in_validation'::public.cycle_state");
    expect(repair).toContain("validated_at = null");
    expect(repair).toContain("response_deadline_at = v_period.response_deadline_at");
    expect(repair).toContain("validation_deadline_at = null");
    expect(repair).not.toContain("finalize_validation_cycle");
    expect(repair).not.toContain("calculate_live_fami");
  });
});
