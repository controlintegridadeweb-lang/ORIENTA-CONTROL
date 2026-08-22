import type { Feature } from "write-excel-file/browser";

export const XLSX_HEADER_STYLE = {
  fontWeight: "bold" as const,
  textColor: "#FFFFFF",
  backgroundColor: "#0F766E",
  alignVertical: "center" as const,
};

export function xlsxHeaderCell(value: string) {
  return { value, ...XLSX_HEADER_STYLE };
}

export function xlsxWrapText(value: string) {
  return { value, wrap: true, alignVertical: "top" as const };
}

export function xlsxDateCell(value: Date | null) {
  if (!value) return null;
  return { value, type: Date, format: "dd/mm/yyyy" as const };
}

export function xlsxDateTimeCell(value: Date | null) {
  if (!value) return null;
  return { value, type: Date, format: "dd/mm/yyyy hh:mm" as const };
}

export function xlsxPercentCell(value: number | null) {
  if (value == null) return null;
  return { value, type: Number, format: "0%" as const };
}

/** Converte índice 1-based na letra da coluna Excel (1 → A, 27 → AA). */
export function excelColumnLetter(indexFromOne: number): string {
  if (!Number.isInteger(indexFromOne) || indexFromOne < 1) {
    throw new Error(`Índice de coluna Excel inválido: ${String(indexFromOne)}`);
  }
  let remaining = indexFromOne;
  let letter = "";
  while (remaining > 0) {
    const rem = (remaining - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letter;
}

/**
 * Habilita AutoFiltro no intervalo do cabeçalho + dados.
 * write-excel-file não expõe isso nativamente.
 */
export function excelAutoFilterFeature<FileContent>(
  columnCount: number,
  dataRowCount: number,
): Feature<FileContent> {
  const lastCol = excelColumnLetter(columnCount);
  const lastRow = Math.max(1, dataRowCount + 1);
  const ref = `A1:${lastCol}${lastRow}`;
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          insert: () => `<autoFilter ref="${ref}"/>`,
        },
      },
    },
  };
}
