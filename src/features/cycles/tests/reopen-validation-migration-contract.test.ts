import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const baseline = readdirSync(resolve(process.cwd(), "supabase", "migrations"))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort()
  .map((name) =>
    readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8"),
  )
  .join("\n");

function functionBody(name: string): string {
  const marker = `function public.${name}`;
  const start = baseline.toLowerCase().indexOf(marker.toLowerCase());
  if (start < 0) throw new Error(`Função ausente: ${name}`);
  const after = baseline.slice(start);
  const dollar = after.match(/as\s+(\$[a-zA-Z0-9_]*\$)/i);
  if (!dollar || dollar.index === undefined) {
    throw new Error(`Corpo não encontrado: ${name}`);
  }
  const tag = dollar[1];
  const bodyStart = dollar.index + dollar[0].length;
  const end = after.indexOf(`${tag};`, bodyStart);
  if (end < 0) throw new Error(`Fim do corpo não encontrado: ${name}`);
  return after.slice(0, end + tag.length + 1);
}

const migration = functionBody("reopen_validation_cycle");

describe("reabertura de validação — contrato de domínio", () => {
  it("cria tabela de auditoria e RPC oficial", () => {
    expect(baseline).toContain("create table public.cycle_validation_reopen_events");
    expect(baseline).toContain(
      "create or replace function public.reopen_validation_cycle(",
    );
    expect(baseline).toContain(
      "grant execute on function public.reopen_validation_cycle(uuid, uuid, text) to service_role",
    );
  });

  it("preserva FAMI anterior e cria processing working", () => {
    expect(migration).toContain("values (p_cycle_id, v_next_version, 'working')");
    expect(migration).toContain("previous_cycle_processing_id");
    expect(migration).toContain("new_cycle_processing_id");
    expect(migration).not.toContain("delete from public.fami_results");
    expect(migration).not.toContain("delete from public.cycle_processings");
  });

  it("exige admin, justificativa e estado validated", () => {
    expect(migration).toContain("validation_reopen_actor_not_authorized");
    expect(migration).toContain("validation_reopen_reason_required");
    expect(migration).toContain("cannot_reopen_validation");
    expect(migration).toContain("validation_already_open");
    expect(migration).toContain("'validated'::public.cycle_state");
    expect(migration).toContain("state = 'in_validation'");
  });

  it("não reabre preenchimento do respondente", () => {
    expect(migration).toMatch(
      /update public\.cycles\s+set state = 'in_validation'/,
    );
    expect(migration).not.toMatch(
      /update public\.cycles\s+set state = 'in_response'/,
    );
  });
});
