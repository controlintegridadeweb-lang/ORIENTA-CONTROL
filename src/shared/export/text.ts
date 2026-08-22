const WINANSI_SUBSTITUTIONS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2026": "...",
  "\u2022": "-",
  "\u00A0": " ",
};

function isWinAnsiChar(code: number): boolean {
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
}

/**
 * Preserva português (Latin-1) e pontuação WinAnsi usada pelas fontes PDF padrão.
 * Substitui apenas caracteres que o Helvetica não consegue desenhar.
 */
export function latinPdfSafe(value: string): string {
  let output = "";
  for (const char of value) {
    if (char === "\n" || char === "\r") {
      output += char;
      continue;
    }
    const code = char.charCodeAt(0);
    if (code === 0x09) {
      output += " ";
      continue;
    }
    if (isWinAnsiChar(code) || char === "\u2013" || char === "\u2014") {
      output += char;
      continue;
    }
    output += WINANSI_SUBSTITUTIONS[char] ?? " ";
  }
  return output;
}

/** Converte texto para o subconjunto ASCII aceito pelas fontes PDF básicas. */
export function asciiSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}
