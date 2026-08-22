import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { execFileSync } from "node:child_process";

function decodeXml(value) {
  return String(value ?? "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([:\w-]+)="([^"]*)"/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
}

function extractTextNodes(xml) {
  const parts = [];
  const pattern = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g;
  let match;
  while ((match = pattern.exec(xml))) parts.push(decodeXml(match[1]));
  return parts.join("");
}

function columnToIndex(reference) {
  const match = String(reference).match(/^([A-Z]+)/);
  if (!match) throw new Error(`Referência de célula inválida: ${reference}`);
  let value = 0;
  for (const character of match[1]) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value - 1;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const values = [];
  const pattern = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let match;
  while ((match = pattern.exec(xml))) values.push(extractTextNodes(match[1]));
  return values;
}

function parseRelationshipTargets(xml) {
  const targets = new Map();
  const pattern = /<(?:\w+:)?Relationship\b([^>]*)\/?\s*>/g;
  let match;
  while ((match = pattern.exec(xml ?? ""))) {
    const attributes = parseAttributes(match[1]);
    if (attributes.Id && attributes.Target) targets.set(attributes.Id, attributes.Target);
  }
  return targets;
}

function parseHyperlinks(sheetXml, relationshipTargets) {
  const links = new Map();
  const pattern = /<(?:\w+:)?hyperlink\b([^>]*)\/?\s*>/g;
  let match;
  while ((match = pattern.exec(sheetXml))) {
    const attributes = parseAttributes(match[1]);
    const reference = attributes.ref;
    const relationshipId = attributes["r:id"];
    const target = relationshipId ? relationshipTargets.get(relationshipId) : attributes.location;
    if (!reference || !target || reference.includes(":")) continue;
    const current = links.get(reference) ?? [];
    if (!current.includes(target)) current.push(target);
    links.set(reference, current);
  }
  return links;
}

function parseCellValue(attributes, body, sharedStrings) {
  const type = attributes.t;
  if (type === "inlineStr") return extractTextNodes(body);

  const valueMatch = body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/);
  const rawValue = valueMatch ? decodeXml(valueMatch[1]) : "";
  if (type === "s") {
    const index = Number(rawValue);
    if (!Number.isInteger(index) || index < 0 || index >= sharedStrings.length) {
      throw new Error(`Índice inválido em sharedStrings: ${rawValue}`);
    }
    return sharedStrings[index];
  }
  if (type === "b") return rawValue === "1" ? "true" : "false";
  if (type === "str") return rawValue;
  return rawValue;
}

function parseWorksheet(sheetXml, sharedStrings, hyperlinks) {
  const rows = new Map();
  const cellPattern = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
  let match;
  while ((match = cellPattern.exec(sheetXml))) {
    const attributes = parseAttributes(match[1]);
    const reference = attributes.r;
    if (!reference) continue;
    const rowMatch = reference.match(/(\d+)$/);
    if (!rowMatch) continue;
    const rowIndex = Number(rowMatch[1]) - 1;
    const columnIndex = columnToIndex(reference);
    const row = rows.get(rowIndex) ?? [];
    row[columnIndex] = {
      value: parseCellValue(attributes, match[2] ?? "", sharedStrings),
      hyperlinks: hyperlinks.get(reference) ?? [],
    };
    rows.set(rowIndex, row);
  }

  const maxRow = Math.max(-1, ...rows.keys());
  return Array.from({ length: maxRow + 1 }, (_, index) => rows.get(index) ?? []);
}

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function extractXlsxArchive(filePath, extractionDirectory) {
  try {
    execFileSync("unzip", ["-qq", filePath, "-d", extractionDirectory], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      const detail = error?.stderr?.toString?.().trim();
      if (detail) throw new Error(`Não foi possível abrir a planilha: ${detail}`);
      throw error;
    }
  }

  // Windows e ambientes sem Info-ZIP: tar.exe extrai arquivos .xlsx (ZIP).
  execFileSync("tar", ["-xf", filePath, "-C", extractionDirectory], {
    stdio: ["ignore", "ignore", "pipe"],
  });
}

export function readFirstWorksheet(filePath) {
  if (!existsSync(filePath)) throw new Error(`Planilha não encontrada: ${filePath}`);
  const extractionDirectory = mkdtempSync(join(tmpdir(), "orienta-xlsx-"));
  try {
    extractXlsxArchive(filePath, extractionDirectory);

    const sharedStrings = parseSharedStrings(
      readOptional(join(extractionDirectory, "xl/sharedStrings.xml")),
    );
    const sheetPath = join(extractionDirectory, "xl/worksheets/sheet1.xml");
    if (!existsSync(sheetPath)) {
      throw new Error(`A planilha ${basename(filePath)} não possui a primeira aba esperada.`);
    }
    const sheetXml = readFileSync(sheetPath, "utf8");
    const relationships = parseRelationshipTargets(
      readOptional(join(extractionDirectory, "xl/worksheets/_rels/sheet1.xml.rels")),
    );
    const hyperlinks = parseHyperlinks(sheetXml, relationships);
    return parseWorksheet(sheetXml, sharedStrings, hyperlinks);
  } catch (error) {
    const detail = error?.stderr?.toString?.().trim();
    if (detail) throw new Error(`Não foi possível abrir a planilha: ${detail}`);
    throw error;
  } finally {
    rmSync(extractionDirectory, { recursive: true, force: true });
  }
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (character === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (character === "\n" || (character === "\r" && next === "\n") || character === "\r") {
      if (character === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function readCsvWorksheet(filePath) {
  if (!existsSync(filePath)) throw new Error(`Planilha não encontrada: ${filePath}`);
  const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return parseCsvRows(source).map((cells) =>
    cells.map((value) => ({ value, hyperlinks: [] })),
  );
}

/** Lê a primeira aba de um .xlsx ou um export CSV no mesmo layout do formulário. */
export function readWorksheetFile(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".csv") return readCsvWorksheet(filePath);
  if (extension === ".xlsx") return readFirstWorksheet(filePath);
  throw new Error(`Formato não suportado (${extension || "sem extensão"}). Use .xlsx ou .csv.`);
}

export function cellValue(row, zeroBasedColumn) {
  return String(row?.[zeroBasedColumn]?.value ?? "").trim();
}

export function cellHyperlinks(row, zeroBasedColumn) {
  return [...(row?.[zeroBasedColumn]?.hyperlinks ?? [])];
}
