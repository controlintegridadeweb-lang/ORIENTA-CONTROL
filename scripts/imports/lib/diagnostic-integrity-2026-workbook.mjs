import { normalizeComparableText } from "./diagnostic-response-import.mjs";
import {
  SUPPORTING_SOURCE_COLUMNS,
  supportingFieldContributesEvidence,
  targetSourceOrdersForSupportingColumn,
} from "./diagnostic-integrity-2026-supporting-map.mjs";
import { cellHyperlinks, cellValue } from "./xlsx-reader.mjs";

export const RAW_ANSWER_COLUMNS = Object.freeze([
  8, 10, 13, 14, 17, 19, 22, 23, 24, 26, 27, 29, 31, 32, 33, 35, 36, 38,
  40, 41, 43, 44, 45, 47, 48, 50, 52, 53, 54, 55, 57, 58, 59, 62, 63, 66,
  67, 69, 70, 72, 73, 75, 77, 79, 80, 82, 84, 85, 87, 88, 89, 90, 91, 94,
  95, 96, 97, 99, 102, 103, 105, 109, 110, 112, 114, 115, 116, 118, 119,
  120, 121, 122, 123, 124, 126, 127, 128, 129, 130, 131, 132, 134, 135,
  136, 137, 139, 140, 141, 143, 144, 146, 147, 148, 149, 152, 154, 156,
  157, 159, 160, 161, 162, 164, 165, 166, 168, 169, 171, 173, 174, 177,
  179, 180, 182, 183, 185, 186, 189, 190, 192, 193, 195, 196, 198, 199,
  201,
]);

const ORGANIZATION_ACRONYM_BY_NAME = new Map(
  [
    ["Vice - Governadoria (GVG)", "GVG"],
    ["Fundação de Atendimento Socioeducativo - FUNDASE", "FUNDASE"],
    ["Corpo de Bombeiros Militar - CBRN", "CBM/RN"],
    ["Instituto de Pesos e Medidas - IPEM", "IPEM"],
    ["Polícia Militar Rio Grande do Norte - PMRN", "PM/RN"],
    ["Secretaria da Agricultura, da Pecuária e da Pesca - SAPE", "SAPE"],
    ["Instituto de Desenvolvimento Sustentável e Meio Ambiente do Rio Grande do Norte - IDEMA", "IDEMA"],
    ["Polícia Científica do Rio Grande do Norte - PCI (ITEP)", "PCI/RN"],
    ["Instituto de Gestão das Águas - IGARN", "IGARN"],
    ["Polícia Civil do Rio Grande do Norte - PCRN", "PC/RN"],
    ["Secretaria de Estado do Trabalho, da Habitação e da Assistência Social - SETHAS", "SETHAS"],
    ["Fundação de Apoio à Pesquisa do Rio Grande do Norte - FAPERN", "FAPERN"],
    ["Fundação José Augusto - FJA", "FJA"],
    ["Universidade Estadual do Rio Grande do Norte - UERN", "UERN"],
    ["Junta Comercial do Rio Grande do Norte - JUCERN", "JUCERN"],
    ["Secretaria de Estado das Mulheres, da Juventude, da Igualdade Racial e dos Direitos Humanos-SEMJIDH", "SEMJIDH"],
    ["Secretaria de Estado da Segurança Pública e da Defesa Social - SESED", "SESED"],
    ["Secretaria do Meio Ambiente e dos Recursos Hídricos - SEMARH", "SEMARH"],
    ["Gabinete Civil -GAC", "GAC"],
    ["Instituto de Assistência Técnica e Extensão Rural do Rio Grande do Norte - EMATER", "EMATER/RN"],
    ["Secretaria de Estado do Planejamento, do Orçamento e Gestão - SEPLAN", "SEPLAN"],
    ["Secretaria de Estado da Saúde Pública - SESAP", "SESAP"],
    ["Secretaria de Estado do Turismo do Rio Grande do Norte - SETUR", "SETUR"],
  ].map(([name, acronym]) => [normalizeComparableText(name), acronym]),
);

const POSITIVE_ANSWERS = new Set(
  [
    "Sim",
    "Sempre",
    "Sim, apenas para uso interno",
    "Sim, com ampla divulgação",
    "Sim, de forma abrangente",
    "Sim, de forma plena",
    "Sim, de forma sistemática",
    "Sim, de forma sistemática e institucionalizada",
  ].map(normalizeComparableText),
);

const NEGATIVE_ANSWERS = new Set(
  [
    "Não",
    "Em fase de definição",
    "Em processo de adesão",
    "Na maioria das vezes",
    "Parcialmente",
    "Parcialmente, de forma não sistemática",
    "Raramente",
    "Sim, de forma limitada",
    "Sim, de forma parcial",
    "Sim, de forma parcial ou pontual",
    "Sim, de forma pontual",
    "Sim, mas não foi formalizado",
  ].map(normalizeComparableText),
);

export function canonicalOrganizationAcronym(organizationName) {
  const acronym = ORGANIZATION_ACRONYM_BY_NAME.get(normalizeComparableText(organizationName));
  if (!acronym) throw new Error(`Órgão sem mapeamento canônico: ${organizationName}`);
  return acronym;
}

export function normalizeHistoricalAnswer(rawValue) {
  const original = String(rawValue ?? "").trim();
  if (!original) {
    return {
      answer: "no",
      answer_original: "Sem resposta",
      inferred: true,
      normalization_reason:
        "Resposta não preenchida na fonte histórica; registrada como Não sem criar informação inexistente.",
    };
  }

  const normalized = normalizeComparableText(original);
  if (POSITIVE_ANSWERS.has(normalized)) {
    return {
      answer: "yes",
      answer_original: original,
      inferred: false,
      normalization_reason:
        normalized === "sim" ? null : "Padronizada para Sim (resposta afirmativa integral).",
    };
  }
  if (NEGATIVE_ANSWERS.has(normalized)) {
    return {
      answer: "no",
      answer_original: original,
      inferred: false,
      normalization_reason:
        normalized === "nao"
          ? null
          : "Padronizada para Não porque a resposta indica atendimento parcial, limitado, pontual, não formalizado ou ainda em implantação.",
    };
  }
  throw new Error(`Resposta histórica não reconhecida: "${original}".`);
}

export function extractUrls(value) {
  const urls = [];
  const pattern = /https?:\/\/[^\s,;|"'<>]+/gi;
  let match;
  while ((match = pattern.exec(String(value ?? "")))) {
    const candidate = match[0].replace(/[).,;]+$/g, "");
    try {
      const parsed = new URL(candidate);
      if (/^https?:$/.test(parsed.protocol) && !urls.includes(candidate)) urls.push(candidate);
    } catch {
      // Conteúdo textual que apenas se parece com URL permanece nas notas.
    }
  }
  return urls;
}

function textWithoutUrls(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s,;|"'<>]+/gi, "")
    .replace(/\s*,\s*,/g, ",")
    .replace(/^\s*[,;]\s*|\s*[,;]\s*$/g, "")
    .trim();
}

function readSupportingFieldCell({ headers, row, sourceColumn }) {
  const zeroBasedColumn = sourceColumn - 1;
  const header = cellValue(headers, zeroBasedColumn);
  const rawValue = cellValue(row, zeroBasedColumn);
  const urls = [...new Set([...extractUrls(rawValue), ...cellHyperlinks(row, zeroBasedColumn)])];
  const text = textWithoutUrls(rawValue);
  if (!header || (!text && urls.length === 0)) return null;
  return {
    source_column: sourceColumn,
    source_header: header,
    text: text || null,
    urls,
    contributes_evidence: supportingFieldContributesEvidence(sourceColumn),
  };
}

/**
 * Campos auxiliares do critério `questionIndex` (0-based), pelo mapeamento
 * explícito coluna legado → source_order — nunca por intervalo posicional.
 */
export function supportingFieldsForQuestion({ headers, row, questionIndex }) {
  const sourceOrder = questionIndex + 1;
  const fields = [];
  for (const sourceColumn of SUPPORTING_SOURCE_COLUMNS) {
    const targets = targetSourceOrdersForSupportingColumn(sourceColumn);
    if (!targets.includes(sourceOrder)) continue;
    const field = readSupportingFieldCell({ headers, row, sourceColumn });
    if (!field) continue;
    fields.push({
      ...field,
      target_source_order: sourceOrder,
    });
  }
  return fields;
}

export function validateRawWorksheet(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    throw new Error("A planilha histórica não contém respostas.");
  }
  const headers = rows[0];
  const requiredHeaders = [
    [0, "Carimbo de data/hora"],
    [1, "Informe em qual órgão ou entidade você atua?"],
    [2, "Nome completo do(a) signatário(a)"],
  ];
  for (const [column, expected] of requiredHeaders) {
    if (normalizeComparableText(cellValue(headers, column)) !== normalizeComparableText(expected)) {
      throw new Error(`Cabeçalho inesperado na coluna ${column + 1}.`);
    }
  }
  if (headers.length < RAW_ANSWER_COLUMNS.at(-1)) {
    throw new Error(
      `Planilha incompleta: ${headers.length} colunas; esperadas ao menos ${RAW_ANSWER_COLUMNS.at(-1)}.`,
    );
  }
  for (const sourceColumn of RAW_ANSWER_COLUMNS) {
    if (!cellValue(headers, sourceColumn - 1)) {
      throw new Error(`Cabeçalho do critério na coluna ${sourceColumn} está vazio.`);
    }
  }
}
