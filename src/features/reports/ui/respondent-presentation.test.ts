import { describe, expect, it } from "vitest";
import {
  defaultReportKindForOfficialPdf,
  OFFICIAL_REPORT_KIND,
} from "./respondent-presentation";

describe("respondent report presentation", () => {
  it("default kind is executive", () => {
    expect(defaultReportKindForOfficialPdf()).toBe("executive");
  });

  it("the single official document is executive + pdf_executive", () => {
    expect(OFFICIAL_REPORT_KIND).toBe("executive");
  });

});
