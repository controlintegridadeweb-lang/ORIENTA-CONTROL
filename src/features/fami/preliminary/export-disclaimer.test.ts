import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").toLowerCase();
}

describe("exportação do FAMI preliminar no acompanhamento", () => {
  it("usa a rota de FAMI preliminar no painel e não o snapshot bimestral do plano", () => {
    const panel = source("src/features/fami/components/preliminary/fami-preliminary-panel.tsx");
    expect(panel).toContain("/api/fami/preliminary/");
    expect(panel).not.toContain("/api/monitoring/bimonthly/");
    expect(panel).toContain("checkpoint?.preliminary");
  });

  it("identifica PDF e Excel como FAMI preliminar não oficial", () => {
    const pdf = source("src/features/fami/preliminary/export-pdf.ts");
    const xlsx = source("src/features/fami/preliminary/export-xlsx.ts");
    expect(pdf).toContain("fami preliminar quadrimestral");
    expect(pdf).toContain("preliminary_export_disclaimer");
    expect(pdf).toContain("renderpreliminarydetailedanalysispdf");
    expect(pdf).not.toContain("critérios com recuperação ou movimentação");
    expect(xlsx).toContain("não substitui o fami anual");
    expect(xlsx).toContain("por eixo");
    expect(xlsx).toContain("por seção");
    expect(xlsx).not.toContain("plano de integridade e compliance");
  });
});
