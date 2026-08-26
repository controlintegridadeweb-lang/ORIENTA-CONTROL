import type { PDFImage, PDFPage } from "pdf-lib";

import { levelMeta } from "@/features/fami";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { latinPdfSafe } from "@/shared/export/text";

import type { OrientaPdfDocument, ReportFonts } from "../document";
import { formatReportPercentage } from "../formatters";
import { reportTheme } from "../theme";

/**
 * Capa institucional do Relatório Oficial ORIENTA.
 *
 * Estrutura visual:
 * - composição decorativa no canto superior esquerdo;
 * - marca ORIENTA centralizada;
 * - metadados organizados em duas colunas;
 * - composição decorativa no canto inferior direito.
 *
 * As decorações ultrapassam propositalmente os limites da página,
 * conforme o layout institucional de referência.
 */

export const OFFICIAL_REPORT_COVER_FIELD_LABELS = [
  "Período de referência",
  "Formulário",
  "Resultado FAMI",
  "Organização",
  "Data de emissão",
] as const;

const COVER_LAYOUT = {
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
  periodValueSize: 18,

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

type CoverPageProps = {
  organizationName: string;
  formName: string;
  famiResultLabel: string;
  generatedAt: string;
  referencePeriodLabel: string;
};

type CornerImageOptions = {
  anchor: "top-left" | "bottom-right";
  maxW: number;
  maxH: number;
  offsetX: number;
  offsetY: number;
};

function buildCoverPageProps(data: OfficialReportData): CoverPageProps {
  const maturityLevel = data.fami.global.maturityLevel;

  const levelLabel =
    maturityLevel == null
      ? "N/A — sem pergunta aplicável"
      : `N${maturityLevel} — ${levelMeta(maturityLevel).shortLabel}`;

  const percentageLabel =
    maturityLevel == null
      ? "N/A"
      : formatReportPercentage(data.fami.global.percentage);

  return {
    organizationName: data.organizationName,
    formName: data.formName,

    famiResultLabel:
      maturityLevel == null
        ? levelLabel
        : `${percentageLabel} · ${levelLabel}`,

    generatedAt: formatPlatformDate(data.generatedAtIso, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),

    referencePeriodLabel: data.referencePeriodLabel,
  };
}

function wrapLines(
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

function drawCornerImage(
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
function drawLabelValue(
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

  const valueLines = wrapLines(
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

function drawBrand(
  page: PDFPage,
  fonts: ReportFonts,
  brandMark: PDFImage | undefined,
): number {
  const { w: pageWidth, h: pageHeight } = reportTheme.page;

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

function renderCoverPageContent(
  doc: OrientaPdfDocument,
  page: PDFPage,
  props: CoverPageProps,
): void {
  const fonts = doc.fonts;

  const {
    w: pageWidth,
    h: pageHeight,
  } = reportTheme.page;

  const margin = COVER_LAYOUT.margin;

  /*
   * Fundo.
   */
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: reportTheme.white,
  });

  const {
    brandMark,
    decoTop,
    decoBottom,
  } = doc.coverAssets;

  /*
   * Decoração superior esquerda.
   */
  if (decoTop) {
    drawCornerImage(page, decoTop, {
      anchor: "top-left",

      maxW: COVER_LAYOUT.decoTop.w,
      maxH: COVER_LAYOUT.decoTop.h,

      offsetX: COVER_LAYOUT.decoTop.offsetX,
      offsetY: COVER_LAYOUT.decoTop.offsetY,
    });
  }

  /*
   * Decoração inferior direita.
   */
  if (decoBottom) {
    drawCornerImage(page, decoBottom, {
      anchor: "bottom-right",

      maxW: COVER_LAYOUT.decoBottom.w,
      maxH: COVER_LAYOUT.decoBottom.h,

      offsetX: COVER_LAYOUT.decoBottom.offsetX,
      offsetY: COVER_LAYOUT.decoBottom.offsetY,
    });
  }

  /*
   * Marca ORIENTA.
   */
  const brandBottom = drawBrand(
    page,
    fonts,
    brandMark ?? undefined,
  );

  /*
   * Colunas dos metadados.
   */
  const usableWidth =
    pageWidth - margin * 2;

  const leftX = margin;

  const rightX =
    margin +
    usableWidth *
      COVER_LAYOUT.rightColumnRatio;

  const leftColumnWidth =
    rightX -
    leftX -
    COVER_LAYOUT.columnGap;

  const rightColumnWidth =
    pageWidth -
    margin -
    rightX;

  /*
   * Os metadados começam somente após o final real
   * da imagem da marca.
   */
  let y =
    brandBottom -
    COVER_LAYOUT.brandToFieldsGap;

  /*
   * Período de referência.
   */
  y = drawLabelValue(
    page,
    fonts,
    leftX,
    y,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[0],
    props.referencePeriodLabel,
    usableWidth,
    COVER_LAYOUT.periodValueSize,
  );

  y -= COVER_LAYOUT.rowGap;

  /*
   * Segunda linha:
   * Formulário | Resultado FAMI
   */
  const secondRowTop = y;

  const formBottom = drawLabelValue(
    page,
    fonts,
    leftX,
    secondRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[1],
    props.formName,
    leftColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  const famiBottom = drawLabelValue(
    page,
    fonts,
    rightX,
    secondRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[2],
    props.famiResultLabel,
    rightColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  /*
   * Usa a coluna que terminou mais abaixo
   * como referência para a próxima linha.
   */
  y =
    Math.min(formBottom, famiBottom) -
    COVER_LAYOUT.rowGap;

  /*
   * Terceira linha:
   * Organização | Data de emissão
   */
  const thirdRowTop = y;

  drawLabelValue(
    page,
    fonts,
    leftX,
    thirdRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[3],
    props.organizationName,
    leftColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  drawLabelValue(
    page,
    fonts,
    rightX,
    thirdRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[4],
    props.generatedAt,
    rightColumnWidth,
    COVER_LAYOUT.valueSize,
  );
}

export function renderCoverPage(
  doc: OrientaPdfDocument,
): void {
  const cover = doc.newPage();

  const props = buildCoverPageProps(
    doc.data,
  );

  renderCoverPageContent(
    doc,
    cover.page,
    props,
  );
}
