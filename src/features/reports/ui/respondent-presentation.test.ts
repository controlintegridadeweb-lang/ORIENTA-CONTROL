import { describe, expect, it } from "vitest";
import {
  defaultReportKindForOfficialPdf,
  OFFICIAL_REPORT_KIND,
  REPORT_KIND_META,
} from "./respondent-presentation";

describe("respondent report presentation", () => {
  it("default kind is executive", () => {
    expect(defaultReportKindForOfficialPdf()).toBe("executive");
  });

  it("the single official document is executive + pdf_executive", () => {
    expect(OFFICIAL_REPORT_KIND).toBe("executive");
    expect(REPORT_KIND_META.executive.label).toBe("Executivo");
  });
});
