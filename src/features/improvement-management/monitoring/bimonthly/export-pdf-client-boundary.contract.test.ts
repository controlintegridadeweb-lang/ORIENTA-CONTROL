import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("fronteira client/server da exportação PDF bimestral", () => {
  it("o client de exportação do plano não importa módulos server-only", () => {
    const client = source(
      "src/features/improvement-management/action-plans/export/action-plan-export-client.ts",
    );

    expect(client).toContain("export-pdf-shared");
    expect(client).not.toMatch(/monitoring\/bimonthly\/export-pdf["']/);
    expect(client).not.toContain('import "server-only"');
  });
});
