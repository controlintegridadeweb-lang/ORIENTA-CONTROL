import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("tabela administrativa de evidências", () => {
  it("usa o mesmo desenho institucional da tabela de referência", () => {
    const table = source("src/features/evidences/components/admin/evidences-table.tsx");
    const row = source("src/features/evidences/components/admin/evidence-row.tsx");
    const tokens = source("src/shared/layout/form-surface.ts");

    expect(tokens).toContain("brandTable");
    expect(tokens).toContain("bg-brand");
    expect(tokens).toContain("bg-sky-50/70");
    expect(table).toContain("formSurface.brandTable");
    expect(row).toContain("formSurface.brandTable");
    expect(row).toContain("primaryButtonSm");
  });
});
