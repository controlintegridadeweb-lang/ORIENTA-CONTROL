import { PDFDocument, type PDFPage } from "pdf-lib";

import {
  COVER_LAYOUT,
  drawCoverBrand,
  drawCoverCornerImage,
  drawCoverDisclaimer,
  drawCoverLabelValue,
} from "@/shared/export/official-pdf-cover";
import { reportTheme } from "@/shared/export/official-pdf-theme";
import type { ReportFonts } from "@/shared/export/official-pdf-types";

/** Mesmos rótulos da capa do relatório de acompanhamento, sem Resultado FAMI. */
export const INTEGRITY_PLAN_COVER_FIELDS = [
  "Período de referência",
  "Formulário",
  "Organização",
  "Data de emissão",
] as const;

const COVER_PNG = {
  logo: "/assets/logo-orienta.png",
  decoTop: "/assets/cover/deco-top-left.png",
  decoBottom: "/assets/cover/deco-bottom-right.png",
} as const;

export type IntegrityPlanCoverMeta = {
  period: string;
  formName: string;
  organizationName: string;
  issuedOnLabel: string;
};

type CoverField = { label: string; value: string };

async function readPublicPng(publicPath: string): Promise<Uint8Array> {
  if (typeof window !== "undefined") {
    const response = await fetch(publicPath);
    if (!response.ok) {
      throw new Error("Não foi possível carregar a identidade visual da capa.");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  const { readFile } = await import(/* webpackIgnore: true */ "node:fs/promises");
  const { join } = await import(/* webpackIgnore: true */ "node:path");
  return new Uint8Array(
    await readFile(join(process.cwd(), "public", publicPath.replace(/^\//, ""))),
  );
}

function coverRows(meta: IntegrityPlanCoverMeta): {
  period: CoverField;
  rows: Array<[CoverField, CoverField | null]>;
} {
  const [periodLabel, formLabel, organizationLabel, issuedLabel] = INTEGRITY_PLAN_COVER_FIELDS;
  return {
    period: { label: periodLabel, value: meta.period },
    rows: [
      [
        { label: formLabel, value: meta.formName },
        { label: organizationLabel, value: meta.organizationName },
      ],
      [{ label: issuedLabel, value: meta.issuedOnLabel }, null],
    ],
  };
}

/**
 * Primeira página do relatório de partida: marca, decorações e metadados
 * do diagnóstico, no mesmo desenho da capa institucional.
 */
export async function drawIntegrityPlanDepartureCover(
  pdf: PDFDocument,
  fonts: ReportFonts,
  page: PDFPage,
  input: {
    title: string;
    disclaimer: string;
    meta: IntegrityPlanCoverMeta | null;
  },
): Promise<void> {
  const [logoBytes, decoTopBytes, decoBottomBytes] = await Promise.all([
    readPublicPng(COVER_PNG.logo),
    readPublicPng(COVER_PNG.decoTop),
    readPublicPng(COVER_PNG.decoBottom),
  ]);
  const [logo, decoTop, decoBottom] = await Promise.all([
    pdf.embedPng(logoBytes),
    pdf.embedPng(decoTopBytes),
    pdf.embedPng(decoBottomBytes),
  ]);

  drawCoverCornerImage(page, decoTop, {
    anchor: "top-left",
    maxW: COVER_LAYOUT.decoTop.w,
    maxH: COVER_LAYOUT.decoTop.h,
    offsetX: COVER_LAYOUT.decoTop.offsetX,
    offsetY: COVER_LAYOUT.decoTop.offsetY,
  });
  drawCoverCornerImage(page, decoBottom, {
    anchor: "bottom-right",
    maxW: COVER_LAYOUT.decoBottom.w,
    maxH: COVER_LAYOUT.decoBottom.h,
    offsetX: COVER_LAYOUT.decoBottom.offsetX,
    offsetY: COVER_LAYOUT.decoBottom.offsetY,
  });

  const brandBottom = drawCoverBrand(page, fonts, undefined, {
    title: input.title,
    logo,
  });

  const margin = COVER_LAYOUT.margin;
  const pageWidth = reportTheme.page.w;
  const usableWidth = pageWidth - margin * 2;
  const leftX = margin;
  const rightX = margin + usableWidth * COVER_LAYOUT.rightColumnRatio;
  const leftColumnWidth = rightX - leftX - COVER_LAYOUT.columnGap;
  const rightColumnWidth = pageWidth - margin - rightX;

  let y = brandBottom - COVER_LAYOUT.brandToFieldsGap;

  if (input.meta) {
    const fields = coverRows(input.meta);
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
  }

  drawCoverDisclaimer(
    page,
    fonts,
    leftX,
    y - COVER_LAYOUT.rowGap,
    input.disclaimer,
    usableWidth,
  );
}
