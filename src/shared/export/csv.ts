export const CSV_BOM = "\uFEFF";

export type CsvOptions = {
  separator?: ";" | "," | "\t";
  includeBom?: boolean;
  lineBreak?: "\r\n" | "\n";
};

const SPREADSHEET_FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

/**
 * Neutraliza fórmulas somente em valores textuais. Valores numéricos reais
 * continuam numéricos no arquivo, inclusive quando negativos.
 */
export function protectSpreadsheetFormula(value: unknown): string {
  const normalized = value == null ? "" : String(value);
  if (typeof value !== "string") return normalized;
  return SPREADSHEET_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function csvEscape(value: unknown, separator: CsvOptions["separator"] = ";"): string {
  const safe = protectSpreadsheetFormula(value);
  const mustQuote = safe.includes(separator) || /["\n\r]/.test(safe);
  return mustQuote ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csvRow(
  cells: readonly unknown[],
  separator: CsvOptions["separator"] = ";",
): string {
  return cells.map((cell) => csvEscape(cell, separator)).join(separator);
}

export function createCsvContent(
  rows: readonly (readonly unknown[])[],
  optionsOrSeparator: CsvOptions | CsvOptions["separator"] = {},
): string {
  const options =
    typeof optionsOrSeparator === "string"
      ? { separator: optionsOrSeparator }
      : optionsOrSeparator;
  const separator = options.separator ?? ";";
  const lineBreak = options.lineBreak ?? "\r\n";
  const body = rows.map((row) => csvRow(row, separator)).join(lineBreak);
  return `${options.includeBom === false ? "" : CSV_BOM}${body}`;
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
