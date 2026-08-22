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
          from: "2026-01-01",
          to: "2026-12-31",
          yearPreset: 2026,
        },
        25,
      ),
    ).toBe(
      "/respondente/relatorios?search=Integridade&status=completed&from=2026-01-01&to=2026-12-31&year=2026&offset=25",
    );
  });

  it("ignora parâmetros inválidos ao restaurar a consulta", () => {
    const params = new URLSearchParams(
      "status=unknown&from=12%2F07%2F2026&to=2026-12-31&year=1999&offset=-1&search=Relat%C3%B3rio",
    );
    expect(parseRespondentReportUrl(params)).toEqual({
      filters: {
        search: "Relatório",
        status: "",
        from: "",
        to: "2026-12-31",
        yearPreset: null,
      },
      offset: 0,
    });
  });
});
