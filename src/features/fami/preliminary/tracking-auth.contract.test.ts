import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("autorização do acompanhamento e do FAMI preliminar", () => {
  it("GET é de leitura autenticada; POST de cálculo/geração é só admin", () => {
    const fami = source("src/app/api/fami/preliminary/route.ts");
    const bimonthly = source("src/app/api/monitoring/bimonthly/route.ts");
    const detail = source("src/app/api/monitoring/bimonthly/[reportId]/route.ts");
    const exported = source("src/app/api/monitoring/bimonthly/[reportId]/export/route.ts");

    expect(fami).toContain('roles: ["admin", "respondent"]');
    expect(fami).toContain('roles: ["admin"]');
    expect(fami).toContain("ensureOrganizationAccess");
    expect(bimonthly).toContain('roles: ["admin", "respondent"]');
    expect(bimonthly).toContain('roles: ["admin"]');
    expect(bimonthly).toContain("ensureOrganizationAccess");
    expect(detail).toContain('roles: ["admin", "respondent"]');
    expect(detail).toContain("ensureOrganizationAccess");
    expect(exported).toContain('roles: ["admin", "respondent"]');
    expect(exported).toContain("ensureOrganizationAccess");
    expect(exported).not.toContain("export const POST");
  });

  it("o cron fecha primeiro o bimestre e depois o quadrimestre", () => {
    const route = source("src/app/api/maintenance/fami-preliminary-close/route.ts");
    const execute = route.slice(route.indexOf("execute:"));
    expect(execute.indexOf("closeDueBimonthlyReports")).toBeGreaterThan(-1);
    expect(execute.indexOf("closeDuePreliminaryQuadrimesters")).toBeGreaterThan(
      execute.indexOf("closeDueBimonthlyReports"),
    );
  });
});
