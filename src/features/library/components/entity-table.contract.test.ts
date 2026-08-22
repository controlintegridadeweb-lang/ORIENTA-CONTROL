import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tabela da biblioteca geral", () => {
  it("usa o mesmo desenho institucional da tabela de referência", () => {
    const table = readFileSync(
      join(process.cwd(), "src/features/library/components/entity-table.tsx"),
      "utf8",
    );

    expect(table).toContain("formSurface.brandTable");
    expect(table).not.toContain("formSurface.table.");
    expect(table).toMatch(/published:\s*"brand"/);
    expect(table).not.toMatch(/published:\s*"success"/);
  });
});
