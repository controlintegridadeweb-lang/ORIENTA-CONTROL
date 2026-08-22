import { describe, expect, it, vi } from "vitest";
import {
  clampRespondentDashboardYear,
  defaultRespondentDashboardYear,
  respondentDashboardYearOptions,
  RESPONDENT_DASHBOARD_MAX_YEAR,
  RESPONDENT_DASHBOARD_MIN_YEAR,
} from "./respondent-dashboard-year";

vi.mock("@/features/fami/fami-year", () => ({
  currentBrtYear: vi.fn(),
}));

import { currentBrtYear } from "@/features/fami";

describe("respondent-dashboard-year", () => {
  it("exposes 2026–2030 range", () => {
    expect(RESPONDENT_DASHBOARD_MIN_YEAR).toBe(2026);
    expect(RESPONDENT_DASHBOARD_MAX_YEAR).toBe(2030);
    expect(respondentDashboardYearOptions()).toEqual([2030, 2029, 2028, 2027, 2026]);
  });

  it("clamps years to the dashboard range", () => {
    expect(clampRespondentDashboardYear(2020)).toBe(2026);
    expect(clampRespondentDashboardYear(2035)).toBe(2030);
    expect(clampRespondentDashboardYear(2028)).toBe(2028);
  });

  it("defaults to current BRT year when in range", () => {
    vi.mocked(currentBrtYear).mockReturnValue(2028);
    expect(defaultRespondentDashboardYear()).toBe(2028);
  });

  it("defaults to 2026 when BRT year is before baseline", () => {
    vi.mocked(currentBrtYear).mockReturnValue(2024);
    expect(defaultRespondentDashboardYear()).toBe(2026);
  });
});
