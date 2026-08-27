import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").toLowerCase();
}

describe("exportação do relatório bimestral", () => {
  it("identifica PDF e Excel como fotografia não oficial", () => {
    const pdf = source("src/features/reports/pdf/overlay-bimonthly-tracking.ts");
    const cover = source("src/features/reports/pdf/pdf/sections/cover-page.tsx");
    const xlsx = source("src/features/improvement-management/monitoring/bimonthly/export-xlsx.ts");
    expect(pdf).toContain("não substitui o resultado fami oficial");
    expect(pdf).toContain("não oficial");
    expect(cover).toContain("relatório bimestral de acompanhamento");
    expect(xlsx).toContain("não substitui o resultado fami oficial");
    expect(xlsx).toContain("não oficial");
  });
});
