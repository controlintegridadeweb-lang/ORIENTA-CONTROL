import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migration = [
  "20260812000200_schema.sql",
  "20260812000500_functions.sql",
  "20260812000800_security_rls.sql",
]
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

describe("form application deadline management migration contract", () => {
  it("cria histórico append-only e RPCs administrativas", () => {
    expect(migration).toContain("create table public.cycle_deadline_events");
    expect(migration).toContain("revoke insert, update, delete on public.cycle_deadline_events");
    expect(migration).toContain("original_response_deadline_at");
    expect(migration).toContain("response_collection_paused_at");
    expect(migration).toContain("admin_change_cycle_response_deadlines");
    expect(migration).toContain("admin_set_cycle_collection_pause");
    expect(migration).toContain("admin_reopen_cycles_for_responses");
    expect(migration).toContain("deadline_must_be_future");
    expect(migration).toContain("reopen_requires_validation_round");
    expect(migration).toContain("and c.response_collection_paused_at is null");
  });
});
