import type { PDFImage, PDFPage } from "pdf-lib";

import { latinPdfSafe } from "@/shared/export/text";

import type { ReportFonts } from "../document";
import { reportTheme } from "../theme";

export const COVER_LAYOUT = {
  margin: 56,

  /**
   * Área máxima ocupada pela marca.
   *
   * O pdf-lib preserva a proporção original do asset.
   * Portanto, estes valores representam apenas os limites máximos.
   *
   * O PNG inclui folga ao redor do lockup (ícone, wordmark e
   * “Relatório oficial”) para os glifos não colarem na borda.
   */
  brandBox: {
    w: 380,
    h: 184,
  },

  /**
   * Centro vertical da marca em relação à altura total da página.
   */
  brandCenterYRatio: 0.61,

  /**
   * Distância vertical entre a parte inferior da marca
   * e o início dos metadados.
   */
  brandToFieldsGap: 44,

  /**
   * Decoração superior esquerda.
   *
   * Os offsets negativos fazem a composição ultrapassar
   * propositalmente as bordas da página.
   */
  decoTop: {
    w: 205,
    h: 205,
    offsetX: -47,
    offsetY: -48,
  },

  /**
   * Decoração inferior direita.
   */
  decoBottom: {
    w: 205,
    h: 205,
    offsetX: -44,
    offsetY: -47,
  },

  labelSize: 10,
  valueSize: 12,
  /** Período de referência na capa bimestral — mesmo corpo dos demais metadados. */
  periodValueSize: 12,

  /** Logo ORIENTA (lockup compacto) na capa do acompanhamento bimestral. */
  trackingLogoMax: {
    w: 280,
    h: 92,
  },

  labelToValueGap: 10,

  /**
   * Espaçamento vertical entre grupos de metadados.
   */
  rowGap: 24,

  /**
   * Proporção utilizada para posicionar a segunda coluna.
   */
  rightColumnRatio: 0.48,

  /**
   * Espaço mínimo entre as duas colunas.
   */
  columnGap: 16,

  /**
   * Entrelinha dos valores que quebram em mais de uma linha.
   */
  valueLineGap: 4,
} as const;

type CornerImageOptions = {
  anchor: "top-left" | "bottom-right";
  maxW: number;
  maxH: number;
  offsetX: number;
  offsetY: number;
};

function wrapCoverLines(
  fonts: ReportFonts,
  text: string,
  size: number,
  maxWidth: number,
  bold = false,
): string[] {
  const font = bold ? fonts.bold : fonts.regular;

  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const lines: string[] = [];

  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine
      ? `${currentLine} ${word}`
      : word;

    const candidateWidth = font.widthOfTextAtSize(candidate, size);

    if (candidateWidth <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getScaledImageSize(
  image: PDFImage,
  maxW: number,
  maxH: number,
): {
  width: number;
  height: number;
} {
  const scale = Math.min(
    maxW / image.width,
    maxH / image.height,
  );

  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

export function drawCoverCornerImage(
  page: PDFPage,
  image: PDFImage,
  options: CornerImageOptions,
): void {
  const { w: pageWidth, h: pageHeight } = reportTheme.page;

  const { width, height } = getScaledImageSize(
    image,
    options.maxW,
    options.maxH,
  );

  if (options.anchor === "top-left") {
    page.drawImage(image, {
      x: options.offsetX,
      y: pageHeight - height - options.offsetY,
      width,
      height,
    });

    return;
  }

  page.drawImage(image, {
    x: pageWidth - width - options.offsetX,
    y: options.offsetY,
    width,
    height,
  });
}

/**
 * Desenha um bloco:
 *
 * Rótulo
 * Valor
 *
 * blockTop representa o limite visual superior do bloco.
 *
 * A função retorna a coordenada vertical disponível
 * abaixo do conteúdo desenhado.
 */
export function drawCoverLabelValue(
  page: PDFPage,
  fonts: ReportFonts,
  x: number,
  blockTop: number,
  label: string,
  value: string,
  maxWidth: number,
  valueSize: number,
): number {
  const safeLabel = latinPdfSafe(label);
  const safeValue = latinPdfSafe(value);

  const labelBaseline =
    blockTop - COVER_LAYOUT.labelSize;

  page.drawText(safeLabel, {
    x,
    y: labelBaseline,
    size: COVER_LAYOUT.labelSize,
    font: fonts.bold,
    color: reportTheme.coverInk,
  });

  const valueLines = wrapCoverLines(
    fonts,
    safeValue,
    valueSize,
    maxWidth,
  );

  let valueBaseline =
    labelBaseline -
    COVER_LAYOUT.labelToValueGap -
    valueSize;

  for (const line of valueLines) {
    page.drawText(line, {
      x,
      y: valueBaseline,
      size: valueSize,
      font: fonts.regular,
      color: reportTheme.slate900,
    });

    valueBaseline -=
      valueSize + COVER_LAYOUT.valueLineGap;
  }

  /**
   * Retorna a posição inferior real do conteúdo,
   * com pequena folga para evitar sobreposição visual.
   */
  return (
    valueBaseline +
    valueSize -
    COVER_LAYOUT.valueLineGap
  );
}

export function drawCoverBrand(
  page: PDFPage,
  fonts: ReportFonts,
  brandMark: PDFImage | undefined,
  tracking?: {
    title: string;
    logo: PDFImage | null;
  },
): number {
  const { w: pageWidth, h: pageHeight } = reportTheme.page;

  if (tracking) {
    return drawTrackingBrand(page, fonts, tracking.title, tracking.logo);
  }

  if (!brandMark) {
    const fallbackTitle = "Relatório oficial";
    const fallbackSize = 24;

    const titleWidth = fonts.bold.widthOfTextAtSize(
      fallbackTitle,
      fallbackSize,
    );

    const titleY =
      pageHeight * COVER_LAYOUT.brandCenterYRatio;

    page.drawText(fallbackTitle, {
      x: (pageWidth - titleWidth) / 2,
      y: titleY,
      size: fallbackSize,
      font: fonts.bold,
      color: reportTheme.coverInk,
    });

    return titleY - 8;
  }

  const { width, height } = getScaledImageSize(
    brandMark,
    COVER_LAYOUT.brandBox.w,
    COVER_LAYOUT.brandBox.h,
  );

  const brandCenterY =
    pageHeight * COVER_LAYOUT.brandCenterYRatio;

  const brandY =
    brandCenterY - height / 2;

  page.drawImage(brandMark, {
    x: (pageWidth - width) / 2,
    y: brandY,
    width,
    height,
  });

  /**
   * Retorna exatamente a base da imagem.
   *
   * Os metadados serão posicionados abaixo deste ponto,
   * evitando sobreposição com a marca.
   */
  return brandY;
}

function drawTrackingBrand(
  page: PDFPage,
  fonts: ReportFonts,
  title: string,
  logo: PDFImage | null,
): number {
  const { w: pageWidth, h: pageHeight } = reportTheme.page;
  const titleSize = 20;
  const usableWidth = pageWidth - COVER_LAYOUT.margin * 2;
  const titleLines = wrapCoverLines(fonts, latinPdfSafe(title), titleSize, usableWidth, true);
  const titleBlockH =
    titleLines.length * (titleSize + COVER_LAYOUT.valueLineGap) - COVER_LAYOUT.valueLineGap;
  const logoMax = COVER_LAYOUT.trackingLogoMax;
  const logoGap = 14;
  const logoSize = logo ? getScaledImageSize(logo, logoMax.w, logoMax.h) : null;
  const stackH = (logoSize ? logoSize.height + logoGap : 0) + titleBlockH;
  let y = pageHeight * COVER_LAYOUT.brandCenterYRatio + stackH / 2;

  if (logo && logoSize) {
    y -= logoSize.height;
    page.drawImage(logo, {
      x: (pageWidth - logoSize.width) / 2,
      y,
      width: logoSize.width,
      height: logoSize.height,
    });
    y -= logoGap;
  }

  for (const line of titleLines) {
    const lineWidth = fonts.bold.widthOfTextAtSize(line, titleSize);
    y -= titleSize;
    page.drawText(line, {
      x: (pageWidth - lineWidth) / 2,
      y,
      size: titleSize,
      font: fonts.bold,
      color: reportTheme.coverInk,
    });
    y -= COVER_LAYOUT.valueLineGap;
  }

  return y + COVER_LAYOUT.valueLineGap - 8;
}

export function drawCoverDisclaimer(
  page: PDFPage,
  fonts: ReportFonts,
  x: number,
  blockTop: number,
  text: string,
  maxWidth: number,
): void {
  const size = 8;
  const lines = wrapCoverLines(fonts, latinPdfSafe(text), size, maxWidth);
  let baseline = blockTop - size;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: baseline,
      size,
      font: fonts.italic,
      color: reportTheme.slate600,
    });
    baseline -= size + COVER_LAYOUT.valueLineGap;
  }
}
