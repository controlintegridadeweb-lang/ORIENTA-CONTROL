import { describe, expect, it } from "vitest";
import {
  officialReportStoragePath,
  REPORTS_BUCKET,
} from "./report-file-path";

describe("officialReportStoragePath", () => {
  it("monta caminho imutável por emissão", () => {
    expect(officialReportStoragePath("org-1", "cyc-1", "proc-1", "emission-1")).toBe(
      "org-1/cyc-1/proc-1/emission-1.pdf",
    );
  });

  it("usa organization_id como primeiro segmento (isolamento de tenant)", () => {
    const path = officialReportStoragePath("org-9", "cyc-2", "proc-2", "emission-9");
    expect(path.split("/")[0]).toBe("org-9");
  });

  it("diferencia reemissões do mesmo processamento", () => {
    expect(officialReportStoragePath("o", "c", "p", "e1")).not.toBe(
      officialReportStoragePath("o", "c", "p", "e2"),
    );
  });

  it("diferencia processamentos", () => {
    expect(officialReportStoragePath("o", "c", "p1", "e")).not.toBe(
      officialReportStoragePath("o", "c", "p2", "e"),
    );
  });

  it("expõe o bucket privado de relatórios", () => {
    expect(REPORTS_BUCKET).toBe("relatorios");
  });
});
