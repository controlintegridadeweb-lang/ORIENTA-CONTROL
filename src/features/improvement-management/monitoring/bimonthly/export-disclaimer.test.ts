import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reportDocumentTitles } from "@/shared/labels/official-labels";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function quotedCopy(text: string): string {
  return [...text.matchAll(/"([^"\\]|\\.)*"/g)].map((match) => match[0]).join("\n");
}

describe("exportação do relatório bimestral", () => {
  it("identifica PDF e Excel como fotografia do plano, sem Resultado FAMI", () => {
    const pdf = source("src/features/reports/pdf/overlay-bimonthly-tracking.ts");
    const labels = source("src/shared/labels/official-labels.ts");
    const xlsx = source("src/features/improvement-management/monitoring/bimonthly/export-xlsx.ts");
    expect(pdf.toLowerCase()).toContain("fotografia do plano de integridade e compliance");
    expect(xlsx.toLowerCase()).toContain("fotografia histórica do plano de integridade e compliance");
    expect(labels.toLowerCase()).toContain(reportDocumentTitles.bimonthly.toLowerCase());
    expect(quotedCopy(pdf).toLowerCase()).not.toContain("fami");
    expect(quotedCopy(xlsx).toLowerCase()).not.toContain("fami");
  });
});
