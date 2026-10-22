import { describe, expect, it } from "vitest";
import { cycleAnswersExportPath } from "./cycle-answers-export-path";

describe("cycleAnswersExportPath", () => {
  it("aponta para a exportação do diagnóstico", () => {
    expect(cycleAnswersExportPath("cycle-1")).toBe("/api/cycles/cycle-1/answers/export");
  });

  it("codifica o identificador na URL", () => {
    expect(cycleAnswersExportPath("a/b")).toBe("/api/cycles/a%2Fb/answers/export");
  });
});
