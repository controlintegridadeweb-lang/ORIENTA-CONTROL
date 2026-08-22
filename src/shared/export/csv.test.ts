import { describe, expect, it } from "vitest";
import {
  CSV_BOM,
  createCsvContent,
  csvEscape,
  protectSpreadsheetFormula,
} from "./csv";

describe("serialização CSV", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@IMPORTXML(A1)", "  =1+1"])(
    "neutraliza fórmula textual: %s",
    (value) => {
      expect(protectSpreadsheetFormula(value)).toBe(`'${value}`);
    },
  );

  it("preserva números negativos reais", () => {
    expect(protectSpreadsheetFormula(-12.5)).toBe("-12.5");
  });

  it("escapa separador, aspas e quebra de linha", () => {
    expect(csvEscape('a;"b"\nc')).toBe('"a;""b""\nc"');
  });

  it("gera BOM e separador configurável em uma única implementação", () => {
    expect(createCsvContent([["A", "B"], [1, 2]], ",")).toBe(
      `${CSV_BOM}A,B\r\n1,2`,
    );
  });
});
