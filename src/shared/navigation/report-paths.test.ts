import { describe, expect, it } from "vitest";
import {
  adminBimonthlyReportsPath,
  adminReportsPath,
  parseReportCatalogKind,
  parseRespondentReportsSearch,
  respondentBimonthlyReportsPath,
  respondentReportsPath,
} from "./report-paths";

describe("report catalog paths", () => {
  it("recorta o histórico administrativo por diagnóstico e tipo bimestral", () => {
    expect(
      adminBimonthlyReportsPath({
        organizationId: "11111111-1111-4111-8111-111111111111",
        cycleId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe(
      "/admin/relatorios?organizationId=11111111-1111-4111-8111-111111111111&cycleId=22222222-2222-4222-8222-222222222222&kind=bimonthly",
    );
  });

  it("não mistura kind inválido na URL administrativa", () => {
    expect(parseReportCatalogKind("weekly")).toBe("");
    expect(adminReportsPath({ kind: "" })).toBe("/admin/relatorios");
  });

  it("preserva cycleId e tipo bimestral na chegada do respondente", () => {
    expect(
      respondentBimonthlyReportsPath({
        cycleId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toBe(
      "/respondente/relatorios?kind=bimonthly&cycleId=22222222-2222-4222-8222-222222222222",
    );
  });

  it("restaura cycleId na consulta do respondente e ignora UUID inválido", () => {
    const parsed = parseRespondentReportsSearch(
      new URLSearchParams(
        "cycleId=22222222-2222-4222-8222-222222222222&kind=annual&status=completed",
      ),
    );
    expect(parsed.cycleId).toBe("22222222-2222-4222-8222-222222222222");
    expect(parsed.kind).toBe("annual");
    expect(parsed.status).toBe("completed");
    expect(parseRespondentReportsSearch(new URLSearchParams("cycleId=nao-uuid")).cycleId).toBe("");
  });

  it("serializa filtros restauráveis do respondente com cycleId", () => {
    expect(
      respondentReportsPath({
        search: "Integridade",
        status: "completed",
        kind: "bimonthly",
        from: "2026-01-01",
        to: "2026-12-31",
        year: 2026,
        cycleId: "22222222-2222-4222-8222-222222222222",
        offset: 25,
      }),
    ).toBe(
      "/respondente/relatorios?search=Integridade&status=completed&kind=bimonthly&from=2026-01-01&to=2026-12-31&year=2026&cycleId=22222222-2222-4222-8222-222222222222&offset=25",
    );
  });
});
