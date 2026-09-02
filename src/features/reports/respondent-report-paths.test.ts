import { describe, expect, it } from "vitest";
import {
  parseRespondentReportUrl,
  respondentReportHistoryPath,
} from "./respondent-report-paths";

describe("respondent report paths", () => {
  it("serializa somente filtros restauráveis", () => {
    expect(
      respondentReportHistoryPath(
        {
          search: "Integridade",
          status: "completed",
          kind: "bimonthly",
          from: "2026-01-01",
          to: "2026-12-31",
          yearPreset: 2026,
          cycleId: "22222222-2222-4222-8222-222222222222",
        },
        25,
      ),
    ).toBe(
      "/respondente/relatorios?search=Integridade&status=completed&kind=bimonthly&from=2026-01-01&to=2026-12-31&year=2026&cycleId=22222222-2222-4222-8222-222222222222&offset=25",
    );
  });

  it("honra cycleId na chegada e ignora parâmetros inválidos", () => {
    const params = new URLSearchParams(
      "status=unknown&kind=weekly&from=12%2F07%2F2026&to=2026-12-31&year=1999&offset=-1&search=Relat%C3%B3rio&cycleId=22222222-2222-4222-8222-222222222222",
    );
    expect(parseRespondentReportUrl(params)).toEqual({
      filters: {
        search: "Relatório",
        status: "",
        kind: "",
        from: "",
        to: "2026-12-31",
        yearPreset: null,
        cycleId: "22222222-2222-4222-8222-222222222222",
      },
      offset: 0,
    });
  });
});
