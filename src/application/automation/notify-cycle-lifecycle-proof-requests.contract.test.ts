import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function notifyCycleLifecycleSql(): string {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260812000500_functions.sql",
    ),
    "utf8",
  );
  const start = sql.indexOf(
    "create or replace function public.notify_cycle_lifecycle()",
  );
  if (start < 0) {
    throw new Error("Função ausente: notify_cycle_lifecycle");
  }
  const next = sql.indexOf("\ncreate or replace function public.", start + 1);
  return next < 0 ? sql.slice(start) : sql.slice(start, next);
}

function compact(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("notify_cycle_lifecycle — comprovação ausente", () => {
  it("conta proof_requested junto com adjustment_requested na devolutiva", () => {
    const sql = compact(notifyCycleLifecycleSql());
    expect(sql).toContain("v_proof_request_count");
    expect(sql).toContain("admin_proof_status = 'proof_requested'");
    expect(sql).toContain("v_total_count := coalesce(v_adjustment_count, 0) + coalesce(v_proof_request_count, 0)");
    expect(sql).toContain("'proof_request_count', v_proof_request_count");
    expect(sql).toContain("'total_count', v_total_count");
  });

  it("notifica o respondente com o total de pendências, inclusive comprovação ausente", () => {
    const sql = compact(notifyCycleLifecycleSql());
    expect(sql).toContain("'evidence_adjustment'");
    expect(sql).toContain("'proof_request_count', v_proof_request_count");
    expect(sql).toContain("format('/respondente/ciclos/%s', new.id)");
    expect(sql).not.toContain("update public.notification_outbox");
    expect(sql).not.toContain("0 evidências");
  });
});
