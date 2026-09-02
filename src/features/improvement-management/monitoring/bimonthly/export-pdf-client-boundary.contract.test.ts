import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("fronteira client/server da exportação PDF bimestral", () => {
  it("o download no acompanhamento não importa módulos server-only", () => {
    const client = source(
      "src/features/fami/components/preliminary/use-bimonthly-reports.ts",
    );

    expect(client).toContain("/api/monitoring/bimonthly/");
    expect(client).not.toMatch(/monitoring\/bimonthly\/export-pdf["']/);
    expect(client).not.toContain('import "server-only"');
  });
});
