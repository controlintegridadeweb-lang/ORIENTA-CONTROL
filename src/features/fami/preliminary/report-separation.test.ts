import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").toLowerCase();
}

describe("separação entre relatório oficial e FAMI preliminar", () => {
  it("não injeta tabelas ou metodologia preliminar no pipeline do PDF oficial", () => {
    const officialSources = [
      "src/features/reports/http/official-route.ts",
      "src/features/reports/pdf/build-official-report-data.ts",
      "src/features/reports/pdf/pdf/build-official-report.ts",
    ]
      .map(source)
      .join("\n");

    expect(officialSources).not.toContain("fami_preliminary");
    expect(officialSources).not.toContain("prelim_v1");
    expect(officialSources).not.toContain("prelim_v2");
    expect(officialSources).not.toContain("action_plan_bimonthly");
  });

  it("identifica a exportação preliminar como não oficial", () => {
    const panel = source(
      "src/features/fami/components/preliminary/fami-preliminary-panel.tsx",
    );
    expect(panel).toContain("fami_preliminar_quadrimestral");
    expect(panel).toContain("nao_oficial");
    expect(panel).not.toContain("fami_oficial_percentual");
    const labels = source("src/shared/labels/official-labels.ts");
    expect(labels).toContain("não entra no pdf do resultado fami");
    expect(labels).toContain("fami anual");
    expect(labels).toContain("o fami preliminar quadrimestral é apenas acompanhamento");
  });
});
