import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tabela de formulários", () => {
  it("usa o mesmo desenho institucional da tabela de referência", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/forms/components/form/forms-list.tsx"),
      "utf8",
    );

    expect(source).toContain("formSurface.brandTable");
    expect(source).not.toMatch(/formSurface\.table\./);
  });

  it("marca formulário publicado com o selo institucional, não um verde paralelo", () => {
    const badge = readFileSync(
      join(process.cwd(), "src/features/forms/components/form/form-publication-state-badge.tsx"),
      "utf8",
    );

    expect(badge).toMatch(/published:\s*"brand"/);
    expect(badge).not.toMatch(/published:\s*"success"/);
  });
});
