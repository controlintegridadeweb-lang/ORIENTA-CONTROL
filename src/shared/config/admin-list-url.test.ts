import { describe, expect, it } from "vitest";
import {
  buildAdminListSearchParams,
  parseAdminListCardFilter,
  parseAdminListPage,
} from "./admin-list-url";

const EMPTY_FILTERS = {
  search: "",
  organizationId: "",
  formId: "",
  cycleId: "",
  axisId: "",
  status: "",
  from: "",
  to: "",
};

describe("admin list URL", () => {
  it("serializa página e cartão ativos junto com os filtros", () => {
    const params = buildAdminListSearchParams({
      layout: "list",
      filters: { ...EMPTY_FILTERS, status: "generated" },
      cardFilter: "without_plan",
      page: 3,
    });

    expect(params.toString()).toBe(
      "layout=list&status=generated&card=without_plan&page=3",
    );
  });

  it("normaliza página e rejeita cartões desconhecidos", () => {
    expect(parseAdminListPage(new URLSearchParams("page=5"))).toBe(5);
    expect(parseAdminListPage(new URLSearchParams("page=0"))).toBe(1);
    expect(
      parseAdminListCardFilter(
        new URLSearchParams("card=overdue"),
        ["overdue", "completed"] as const,
      ),
    ).toBe("overdue");
    expect(
      parseAdminListCardFilter(
        new URLSearchParams("card=unknown"),
        ["overdue", "completed"] as const,
      ),
    ).toBeNull();
  });
});
