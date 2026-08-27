import type { PDFPage } from "pdf-lib";

import { levelMeta } from "@/features/fami";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";

import type { OrientaPdfDocument } from "../document";
import { formatReportPercentage } from "../formatters";
import { reportTheme } from "../theme";
import {
  COVER_LAYOUT,
  drawCoverBrand,
  drawCoverCornerImage,
  drawCoverDisclaimer,
  drawCoverLabelValue,
} from "./cover-page-draw";

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

const TRACKING_COVER_TITLE = "Relatório bimestral de acompanhamento";

type CoverPageProps = {
  organizationName: string;
  formName: string;
  famiResultLabel: string;
  generatedAt: string;
  referencePeriodLabel: string;
  trackingTitle: string | null;
  disclaimer: string | null;
};

function buildCoverPageProps(data: OfficialReportData): CoverPageProps {
  const maturityLevel = data.fami.global.maturityLevel;
  const tracking = data.tracking;

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

    generatedAt: tracking
      ? tracking.cutoffLabel
      : formatPlatformDate(data.generatedAtIso, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),

    referencePeriodLabel: tracking
      ? `${tracking.bimesterLabel} de ${data.referenceYear} (${tracking.periodRangeLabel})`
      : data.referencePeriodLabel,
    trackingTitle: tracking ? TRACKING_COVER_TITLE : null,
    disclaimer: tracking?.disclaimer ?? null,
  };
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

  if (decoTop) {
    drawCoverCornerImage(page, decoTop, {
      anchor: "top-left",
      maxW: COVER_LAYOUT.decoTop.w,
      maxH: COVER_LAYOUT.decoTop.h,
      offsetX: COVER_LAYOUT.decoTop.offsetX,
      offsetY: COVER_LAYOUT.decoTop.offsetY,
    });
  }

  if (decoBottom) {
    drawCoverCornerImage(page, decoBottom, {
      anchor: "bottom-right",
      maxW: COVER_LAYOUT.decoBottom.w,
      maxH: COVER_LAYOUT.decoBottom.h,
      offsetX: COVER_LAYOUT.decoBottom.offsetX,
      offsetY: COVER_LAYOUT.decoBottom.offsetY,
    });
  }

  const brandBottom = drawCoverBrand(
    page,
    fonts,
    props.trackingTitle ? undefined : brandMark ?? undefined,
    props.trackingTitle
      ? { title: props.trackingTitle, logo: doc.logo }
      : undefined,
  );

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

  let y =
    brandBottom -
    COVER_LAYOUT.brandToFieldsGap;

  y = drawCoverLabelValue(
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

  const secondRowTop = y;

  const formBottom = drawCoverLabelValue(
    page,
    fonts,
    leftX,
    secondRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[1],
    props.formName,
    leftColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  const famiBottom = drawCoverLabelValue(
    page,
    fonts,
    rightX,
    secondRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[2],
    props.famiResultLabel,
    rightColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  y =
    Math.min(formBottom, famiBottom) -
    COVER_LAYOUT.rowGap;

  const thirdRowTop = y;

  const orgBottom = drawCoverLabelValue(
    page,
    fonts,
    leftX,
    thirdRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[3],
    props.organizationName,
    leftColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  const dateBottom = drawCoverLabelValue(
    page,
    fonts,
    rightX,
    thirdRowTop,
    OFFICIAL_REPORT_COVER_FIELD_LABELS[4],
    props.generatedAt,
    rightColumnWidth,
    COVER_LAYOUT.valueSize,
  );

  if (props.disclaimer) {
    drawCoverDisclaimer(
      page,
      fonts,
      leftX,
      Math.min(orgBottom, dateBottom) - COVER_LAYOUT.rowGap,
      props.disclaimer,
      usableWidth,
    );
  }
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
