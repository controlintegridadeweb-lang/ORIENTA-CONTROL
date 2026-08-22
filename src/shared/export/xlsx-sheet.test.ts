import { describe, expect, it } from "vitest";
import {
  excelAutoFilterFeature,
  excelColumnLetter,
  xlsxDateCell,
  xlsxPercentCell,
} from "./xlsx-sheet";

describe("excelColumnLetter", () => {
  it("converte índices 1-based em letras de coluna", () => {
    expect(excelColumnLetter(1)).toBe("A");
    expect(excelColumnLetter(14)).toBe("N");
    expect(excelColumnLetter(16)).toBe("P");
    expect(excelColumnLetter(27)).toBe("AA");
  });
});

describe("xlsx typed cells", () => {
  it("mantém progresso 0% e 100% como fração, sem tratar 0 como ausente", () => {
    expect(xlsxPercentCell(0)).toEqual({ value: 0, type: Number, format: "0%" });
    expect(xlsxPercentCell(1)).toEqual({ value: 1, type: Number, format: "0%" });
    expect(xlsxPercentCell(null)).toBeNull();
  });

  it("exporta datas reais no formato brasileiro", () => {
    const date = new Date(Date.UTC(2026, 7, 14, 12));
    expect(xlsxDateCell(date)).toEqual({
      value: date,
      type: Date,
      format: "dd/mm/yyyy",
    });
    expect(xlsxDateCell(null)).toBeNull();
  });
});

describe("excelAutoFilterFeature", () => {
  it("gera o intervalo do AutoFiltro a partir da quantidade de colunas e linhas", () => {
    const feature = excelAutoFilterFeature(14, 3);
    const insert = feature.files?.transform?.["xl/worksheets/sheet{id}.xml"]?.insert;
    expect(typeof insert).toBe("function");
    expect(insert?.([] as never, { sheetIndex: 0, sheetId: "1" })).toBe(
      '<autoFilter ref="A1:N4"/>',
    );
  });
});
