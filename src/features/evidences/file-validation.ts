const MAX_EVIDENCE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION_PX = 10_000;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_PDF_PAGES = 200;
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "msi", "msp", "scr", "ps1", "vbs", "js", "jse",
  "mjs", "cjs", "html", "htm", "shtml", "xhtml", "svg", "svgz", "xml", "xsl", "hta",
  "lnk", "url", "jar", "war", "apk", "dmg", "iso", "img", "vhd", "vhdx", "bin",
  "sh", "bash", "zsh", "php", "asp", "aspx", "cgi", "py", "rb", "pl", "wasm",
  "docm", "xlsm", "pptm", "dotm", "xltm", "zip", "rar", "7z", "gz", "tgz", "bz2",
  "xz", "tar", "cab", "doc", "xls", "ppt", "docx", "xlsx", "pptx", "odt", "ods", "odp",
]);

export type EvidenceFileDescriptor = {
  filename: string;
  extension: string;
  declaredMimeType: string;
  canonicalMimeType: string;
};

type SignatureRule = {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  canonicalMimeType: string;
  matches: (bytes: Uint8Array) => boolean;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

const RULES: readonly SignatureRule[] = [
  {
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
    canonicalMimeType: "application/pdf",
    matches: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]),
  },
  {
    extensions: ["png"],
    mimeTypes: ["image/png"],
    canonicalMimeType: "image/png",
    matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    extensions: ["jpg", "jpeg"],
    mimeTypes: ["image/jpeg"],
    canonicalMimeType: "image/jpeg",
    matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    extensions: ["webp"],
    mimeTypes: ["image/webp"],
    canonicalMimeType: "image/webp",
    matches: (bytes) =>
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes.length >= 12 &&
      String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) === "WEBP",
  },
];

const ALLOWED_EXTENSIONS_MESSAGE =
  "Este tipo de documento não pode ser enviado. Envie PDF, PNG, JPEG ou WebP.";

function extensionOf(filename: string): string {
  const match = filename.trim().toLocaleLowerCase("pt-BR").match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function countDotsInBasename(filename: string): number {
  const base = filename.trim().split(/[/\\]/).pop() ?? "";
  return (base.match(/\./g) ?? []).length;
}

/** Rejeita nomes com path traversal, caracteres de controle ou extensões compostas enganosas. */
export function assertSafeUploadFilename(filename: string): void {
  const trimmed = filename.trim();
  if (!trimmed || trimmed.length > 240) {
    throw new Error("O nome do arquivo é inválido.");
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new Error("O nome do arquivo contém caracteres não permitidos.");
  }
  if (trimmed.includes("..") || /[/\\]/.test(trimmed) || trimmed.includes("\0")) {
    throw new Error("O nome do arquivo contém caminho não permitido.");
  }
  if (countDotsInBasename(trimmed) > 1) {
    throw new Error("Arquivos com múltiplas extensões não são permitidos.");
  }
  const extension = extensionOf(trimmed);
  if (!extension) {
    throw new Error(ALLOWED_EXTENSIONS_MESSAGE);
  }
  if (DANGEROUS_EXTENSIONS.has(extension) && !RULES.some((rule) => rule.extensions.includes(extension))) {
    throw new Error(ALLOWED_EXTENSIONS_MESSAGE);
  }
}

export function describeAllowedEvidenceFile(input: {
  filename: string;
  mimeType: string | null | undefined;
  sizeBytes: number;
}): EvidenceFileDescriptor {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("O arquivo está vazio ou não pôde ser validado.");
  }
  if (input.sizeBytes > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("O arquivo excede o tamanho permitido.");
  }

  assertSafeUploadFilename(input.filename);

  const extension = extensionOf(input.filename);
  const declaredMimeType = (input.mimeType ?? "").trim().toLocaleLowerCase("pt-BR");
  const rule = RULES.find((candidate) => candidate.extensions.includes(extension));
  if (!rule) {
    throw new Error(ALLOWED_EXTENSIONS_MESSAGE);
  }
  if (declaredMimeType && !rule.mimeTypes.includes(declaredMimeType)) {
    throw new Error("O formato do arquivo não é permitido.");
  }

  return {
    filename: input.filename.trim(),
    extension,
    declaredMimeType,
    canonicalMimeType: rule.canonicalMimeType,
  };
}

export function verifyUploadedFileSize(
  expectedSize: number,
  actualSize: number | null,
): void {
  if (
    actualSize == null ||
    !Number.isInteger(actualSize) ||
    actualSize !== expectedSize ||
    actualSize <= 0 ||
    actualSize > MAX_EVIDENCE_FILE_BYTES
  ) {
    throw new Error("O tamanho do arquivo enviado não corresponde ao tamanho informado.");
  }
}

/** Office/OpenXML não entram na allowlist desta versão. */
export function evidenceFileNeedsArchiveInspection(_descriptor: EvidenceFileDescriptor): boolean {
  return false;
}

export function verifyEvidenceArchiveStructure(
  _descriptor: EvidenceFileDescriptor,
  _centralDirectoryBytes: Uint8Array,
): void {
  // Allowlist atual não inclui contêineres ZIP/OpenXML.
}

export function verifyEvidenceFileSignature(
  descriptor: EvidenceFileDescriptor,
  bytes: Uint8Array,
): string {
  if (!bytes.length) {
    throw new Error("O arquivo está vazio ou não pôde ser validado.");
  }
  const rule = RULES.find((candidate) => candidate.extensions.includes(descriptor.extension));
  if (!rule || !rule.matches(bytes)) {
    throw new Error("O conteúdo do arquivo não corresponde à extensão informada.");
  }
  return rule.canonicalMimeType;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function assertImageDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION_PX ||
    height > MAX_IMAGE_DIMENSION_PX
  ) {
    throw new Error("A imagem possui dimensões inválidas ou excessivas.");
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error("A imagem excede o limite de pixels permitido.");
  }
}

export function verifyImageStructuralLimits(
  descriptor: EvidenceFileDescriptor,
  bytes: Uint8Array,
): void {
  if (descriptor.extension === "png") {
    if (bytes.length < 24) {
      throw new Error("O arquivo está corrompido ou não pôde ser validado.");
    }
    assertImageDimensions(readUint32BE(bytes, 16), readUint32BE(bytes, 20));
    return;
  }

  if (descriptor.extension === "webp") {
    if (bytes.length < 30) {
      throw new Error("O arquivo está corrompido ou não pôde ser validado.");
    }
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunk === "VP8X" && bytes.length >= 30) {
      const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      assertImageDimensions(width, height);
      return;
    }
    if (chunk === "VP8 " && bytes.length >= 30) {
      const width = readUint16LE(bytes, 26) & 0x3fff;
      const height = readUint16LE(bytes, 28) & 0x3fff;
      assertImageDimensions(width, height);
      return;
    }
    if (chunk === "VP8L" && bytes.length >= 25) {
      const bits = readUint32LE(bytes, 21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      assertImageDimensions(width, height);
      return;
    }
    throw new Error("O arquivo está corrompido ou não pôde ser validado.");
  }

  if (descriptor.extension === "jpg" || descriptor.extension === "jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      if (marker === 0x00 || marker === 0xff) {
        offset += 1;
        continue;
      }
      const length = readUint16BE(bytes, offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) {
        throw new Error("O arquivo está corrompido ou não pôde ser validado.");
      }
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = readUint16BE(bytes, offset + 5);
        const width = readUint16BE(bytes, offset + 7);
        assertImageDimensions(width, height);
        return;
      }
      offset += 2 + length;
    }
    throw new Error("O arquivo está corrompido ou não pôde ser validado.");
  }
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

/** Confirma encerramento básico do PDF e ausência de truncamento grosseiro. */
export function verifyPdfTrailer(bytes: Uint8Array): void {
  if (bytes.length < 8) {
    throw new Error("O arquivo está corrompido ou não pôde ser validado.");
  }
  const latin1 = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  if (!/%%EOF\s*$/.test(latin1) && !latin1.includes("%%EOF")) {
    throw new Error("O arquivo está corrompido ou não pôde ser validado.");
  }
}

/** Conta páginas por marcadores sem executar JavaScript nem abrir anexos. */
export function verifyPdfPageBudget(headerAndSample: Uint8Array): void {
  const text = Array.from(headerAndSample, (value) => String.fromCharCode(value)).join("");
  const countMatches = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
  if (countMatches?.[1]) {
    const count = Number(countMatches[1]);
    if (Number.isInteger(count) && count > MAX_PDF_PAGES) {
      throw new Error("O PDF excede a quantidade máxima de páginas permitida.");
    }
  }
  const pageObjects = text.match(/\/Type\s*\/Page(?![sA-Za-z])/g);
  if (pageObjects && pageObjects.length > MAX_PDF_PAGES) {
    throw new Error("O PDF excede a quantidade máxima de páginas permitida.");
  }
}

export const EVIDENCE_FILE_LIMITS = {
  maxBytes: MAX_EVIDENCE_FILE_BYTES,
  maxImageDimensionPx: MAX_IMAGE_DIMENSION_PX,
  maxImagePixels: MAX_IMAGE_PIXELS,
  maxPdfPages: MAX_PDF_PAGES,
  allowedExtensions: ["pdf", "png", "jpg", "jpeg", "webp"] as const,
  allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const,
} as const;
