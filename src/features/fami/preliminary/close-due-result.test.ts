import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCloseDuePreliminaryResult } from "./close-due-result";

describe("contrato do fechamento automático quadrimestral", () => {
  it("aceita execução vazia, idempotente e com falha parcial", () => {
    expect(
      parseCloseDuePreliminaryResult({
        ok: true,
        closed: 0,
        skipped: 2,
        failed: 0,
        errors: [],
        reason: "lock_held",
      }).reason,
    ).toBe("lock_held");

    expect(
      parseCloseDuePreliminaryResult({
        ok: true,
        closed: 1,
        skipped: 3,
        failed: 0,
        errors: [],
      }).closed,
    ).toBe(1);

    expect(
      parseCloseDuePreliminaryResult({
        ok: false,
        closed: 2,
        skipped: 1,
        failed: 1,
        errors: [
          {
            cycleId: "11111111-1111-4111-8111-111111111111",
            referenceYear: 2026,
            quadrimester: 1,
            error: "preliminary_official_reconstruction_mismatch",
          },
        ],
      }).failed,
    ).toBe(1);
  });

  it("rejeita contrato inválido em vez de mascarar o fechamento", () => {
    expect(() => parseCloseDuePreliminaryResult({ ok: true })).toThrow(/contrato inválido/);
  });

  it("usa cron autenticado e a mesma RPC de materialização", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/maintenance/fami-preliminary-close/route.ts"),
      "utf8",
    );
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260813000100_fami_preliminary_open_period_and_close.sql",
      ),
      "utf8",
    );
    expect(route).toContain("createCronRoute");
    expect(route).toContain("closeDuePreliminaryQuadrimesters");
    expect(sql).toContain("pg_try_advisory_xact_lock");
    expect(sql).toContain("unique_violation");
    expect(sql).toContain("materialize_fami_preliminary");
    expect(sql).toContain("closed_at is not null");
  });
});
