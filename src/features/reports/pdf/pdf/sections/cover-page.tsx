import type { PDFPage } from "pdf-lib";

import { levelMeta } from "@/features/fami";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";
import { reportDocumentTitles } from "@/shared/labels/official-labels";
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

export const TRACKING_REPORT_COVER_FIELD_LABELS = [
  "Período de referência",
  "Formulário",
  "Organização",
  "Data de emissão",
] as const;

type CoverField = { label: string; value: string };

export function officialReportCoverTitle(
  data: Pick<OfficialReportData, "tracking" | "referenceYear">,
): string {
  if (data.tracking) return reportDocumentTitles.bimonthly;
  return reportDocumentTitles.annual(data.referenceYear);
}

type CoverPageProps = {
  organizationName: string;
  formName: string;
  famiResultLabel: string;
  generatedAt: string;
  referencePeriodLabel: string;
  coverTitle: string;
  includeFamiResult: boolean;
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
    coverTitle: officialReportCoverTitle(data),
    includeFamiResult: tracking == null,
    disclaimer: tracking?.disclaimer ?? null,
  };
}

function coverFieldRows(props: CoverPageProps): {
  period: CoverField;
  rows: Array<[CoverField, CoverField | null]>;
} {
  const period: CoverField = {
    label: OFFICIAL_REPORT_COVER_FIELD_LABELS[0],
    value: props.referencePeriodLabel,
  };
  const form: CoverField = {
    label: OFFICIAL_REPORT_COVER_FIELD_LABELS[1],
    value: props.formName,
  };
  const fami: CoverField = {
    label: OFFICIAL_REPORT_COVER_FIELD_LABELS[2],
    value: props.famiResultLabel,
  };
  const org: CoverField = {
    label: OFFICIAL_REPORT_COVER_FIELD_LABELS[3],
    value: props.organizationName,
  };
  const issued: CoverField = {
    label: OFFICIAL_REPORT_COVER_FIELD_LABELS[4],
    value: props.generatedAt,
  };

  if (props.includeFamiResult) {
    return {
      period,
      rows: [
        [form, fami],
        [org, issued],
      ],
    };
  }

  return {
    period,
    rows: [
      [form, org],
      [issued, null],
    ],
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
    undefined,
    {
      title: props.coverTitle,
      logo: doc.logo,
    },
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

  const fields = coverFieldRows(props);

  let y =
    brandBottom -
    COVER_LAYOUT.brandToFieldsGap;

  y = drawCoverLabelValue(
    page,
    fonts,
    leftX,
    y,
    fields.period.label,
    fields.period.value,
    usableWidth,
    COVER_LAYOUT.periodValueSize,
  );

  for (const [left, right] of fields.rows) {
    y -= COVER_LAYOUT.rowGap;
    const leftBottom = drawCoverLabelValue(
      page,
      fonts,
      leftX,
      y,
      left.label,
      left.value,
      right ? leftColumnWidth : usableWidth,
      COVER_LAYOUT.valueSize,
    );
    const rightBottom = right
      ? drawCoverLabelValue(
          page,
          fonts,
          rightX,
          y,
          right.label,
          right.value,
          rightColumnWidth,
          COVER_LAYOUT.valueSize,
        )
      : leftBottom;
    y = Math.min(leftBottom, rightBottom);
  }

  if (props.disclaimer) {
    drawCoverDisclaimer(
      page,
      fonts,
      leftX,
      y - COVER_LAYOUT.rowGap,
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
