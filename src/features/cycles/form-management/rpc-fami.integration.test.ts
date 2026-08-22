import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const reportPath = join(
  process.cwd(),
  "var/form-management-rpc-pglite-report.json",
);
const scriptPath = join(
  process.cwd(),
  "scripts/database/form-management-rpc-pglite.mjs",
);

/**
 * Integração real em Postgres descartável (PGlite):
 * baseline timestampada vigente, incluindo prazo, pausa e reaberturas total e parcial
 * e impacto em FAMI.
 *
 * Roda por padrão em `npm test`. Desligue com SKIP_FORM_MGMT_RPC=1 se precisar
 * de um smoke rápido sem subir o schema.
 */
const runLive = process.env.SKIP_FORM_MGMT_RPC !== "1";

describe("gestão de formulário — RPC + FAMI (PGlite)", () => {
  it("documenta o script de integração", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    expect(pkg.scripts["test:form-mgmt-rpc"]).toContain(
      "form-management-rpc-pglite.mjs",
    );
    expect(existsSync(scriptPath)).toBe(true);
  });

  it.skipIf(!runLive)(
    "aplica schema, exerce RPCs e preserva FAMI de ponta a ponta",
    () => {
      execFileSync(process.execPath, [scriptPath], {
        cwd: process.cwd(),
        stdio: "pipe",
        timeout: 120_000,
        env: process.env,
      });

      expect(existsSync(reportPath)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      expect(report.appliedCount).toBe(18);
      expect(report.failures).toEqual([]);
      expect(report.verdict).toBe("PASS_FORM_MANAGEMENT_RPC");

      const names = (report.assertions as { name: string; ok: boolean }[]).map(
        (a) => a.name,
      );
      expect(names).toEqual(
        expect.arrayContaining([
          "original_deadline_preserved",
          "response_deadline_changed",
          "paused_blocks_question_edit",
          "fami_preserved_after_validation_reopen",
          "fami_still_points_to_previous_processing",
          "working_processing_created",
          "reopen_completed_requires_official_report",
          "partial_scope_allows_selected",
          "partial_scope_blocks_other",
          "fami_preserved_after_response_reopen",
        ]),
      );
      expect(
        (report.assertions as { ok: boolean }[]).every((a) => a.ok),
      ).toBe(true);
    },
    120_000,
  );
});
