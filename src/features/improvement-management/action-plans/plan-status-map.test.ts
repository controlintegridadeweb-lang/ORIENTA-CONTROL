import { describe, expect, it } from "vitest";
import {
  formatResponsibleLabel,
  parseResponsibleLabel,
  planStatusFromDb,
  planStatusToDb,
} from "./plan-status-map";

describe("plan-status-map", () => {
  it("round-trips UI status through DB enum", () => {
    expect(planStatusFromDb(planStatusToDb("in_progress"))).toBe("in_progress");
    expect(planStatusToDb(planStatusFromDb("doing"))).toBe("doing");
    expect(planStatusToDb("completed")).toBe("done");
  });

  it("formats and parses responsible label", () => {
    const label = formatResponsibleLabel("TI", "Maria");
    expect(label).toBe("TI — Maria");
    expect(parseResponsibleLabel(label)).toEqual({ sector: "TI", name: "Maria" });
  });
});
