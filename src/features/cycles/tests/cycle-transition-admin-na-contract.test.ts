import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

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
    const start = sql.toLowerCase().indexOf(needle);
    if (start < 0) continue;
    body = sql.slice(start);
  }
  expect(body.length, `${functionName} ausente`).toBeGreaterThan(0);
  return body.replace(/\s+/g, " ");
}

describe("guarda de transição com N/A administrativo", () => {
  it("exclui evidências de critérios com N/A admin ao validar o ciclo", () => {
    const trigger = lastFunctionBody("enforce_cycle_transition_integrity()");
    const unresolvedBlock = trigger.slice(
      trigger.indexOf("in_validation'::public.cycle_state"),
      trigger.indexOf("validation_has_unresolved_evidence") +
        "validation_has_unresolved_evidence".length,
    );

    expect(unresolvedBlock).toContain(
      "coalesce(resp.admin_applicability_status, '') <> 'not_applicable'",
    );
    expect(unresolvedBlock).toContain(
      "'pending'::public.evidence_validation_status",
    );
    expect(unresolvedBlock).toContain(
      "'adjustment_requested'::public.evidence_validation_status",
    );
  });

  it("mantém a mesma exclusão na prontidão canônica de finalização", () => {
    const readiness = lastFunctionBody(
      "get_validation_finalization_readiness(",
    );
    const countStart = readiness.indexOf(
      "select count(*)::integer into v_pending_evidence_count",
    );
    const countEnd = readiness.indexOf(
      "select count(*)::integer into v_pending_na_count",
      countStart,
    );
    expect(countStart).toBeGreaterThan(-1);
    expect(countEnd).toBeGreaterThan(countStart);
    const pendingEvidence = readiness.slice(countStart, countEnd);

    expect(pendingEvidence).toContain(
      "coalesce(resp.admin_applicability_status, '') <> 'not_applicable'",
    );
  });
});
