import { reportLevelLabel } from "@/features/reports/pdf/build-official-report-data";
import type { Cursor, OrientaPdfDocument } from "../document";
import { contentWidth, reportAxisTheme, reportTheme } from "../theme";
import { drawMiniBarChart } from "../helpers";
import { drawReportTable } from "../table";

const LEVELS = [
  { n: 1, label: "Inicial" },
  { n: 2, label: "Básico" },
  { n: 3, label: "Intermediário" },
  { n: 4, label: "Avançado" },
  { n: 5, label: "Excelência" },
];

export function renderFamiSection(doc: OrientaPdfDocument): Cursor {
  let cur = doc.beginMajorSection(
    "Resultado geral do FAMI",
    undefined,
    "fami",
  );

  const global = doc.data.fami.global;
  const globalIsNotApplicable = global.maturityLevel == null;
  const scoreH = globalIsNotApplicable ? 92 : 72;
  const card = doc.drawRoundedCard(cur, scoreH, { fill: reportTheme.brandLight });
  card.cursor.page.drawText("Resultado consolidado", {
    x: card.innerX,
    y: card.innerY,
    size: 9,
    font: doc.fonts.regular,
    color: reportTheme.slate500,
  });
  card.cursor.page.drawText(globalIsNotApplicable ? "N/A" : `${global.percentage.toFixed(1)}%`, {
    x: card.innerX,
    y: card.innerY - 24,
    size: 30,
    font: doc.fonts.bold,
    color: reportTheme.brandDark,
  });
  card.cursor.page.drawText(reportLevelLabel(global.maturityLevel), {
    x: card.innerX + 108,
    y: card.innerY - 20,
    size: 12,
    font: doc.fonts.bold,
    color: reportTheme.slate700,
  });
  if (globalIsNotApplicable) {
    card.cursor.page.drawText("Sem critérios aplicáveis ao FAMI neste diagnóstico.", {
      x: card.innerX,
      y: card.innerY - 54,
      size: 9,
      font: doc.fonts.regular,
      color: reportTheme.slate600,
    });
  }
  cur = { page: card.cursor.page, y: card.cursor.y - 20 };

  if (!globalIsNotApplicable) {
    cur = doc.ensureSpace(cur, 40);
    cur.page.drawText("Escala de maturidade (1–5)", {
      x: reportTheme.margin,
      y: cur.y,
      size: 9,
      font: doc.fonts.bold,
      color: reportTheme.slate600,
    });
    cur = { ...cur, y: cur.y - 20 };
    const scaleW = contentWidth();
    const step = scaleW / 5;
    LEVELS.forEach((lv, i) => {
      const active = global.maturityLevel === lv.n;
      const x = reportTheme.margin + i * step;
      cur.page.drawRectangle({
        x: x + 2,
        y: cur.y - 14,
        width: step - 6,
        height: 14,
        color: active ? reportTheme.brand : reportTheme.slate100,
        borderColor: active ? reportTheme.brandDark : reportTheme.slate200,
        borderWidth: 0.5,
      });
      cur.page.drawText(String(lv.n), {
        x: x + step / 2 - 4,
        y: cur.y - 11,
        size: 8,
        font: doc.fonts.bold,
        color: active ? reportTheme.white : reportTheme.slate500,
      });
    });
    cur = { ...cur, y: cur.y - 32 };
  }

  cur = doc.drawSubsectionTitle(cur, "Resultado por eixo");

  const axes = doc.data.fami.byAxis;
  const applicableAxes = axes.filter((axis) => axis.maturityLevel != null);
  if (applicableAxes.length > 0) {
    cur = doc.ensureBlock(cur, 130);
    cur = drawMiniBarChart(
      doc,
      cur,
      applicableAxes.map((a) => ({
        label: a.axisName,
        value: a.percentage,
        color: reportAxisTheme(a.axisName).primary,
      })),
      110,
    );
    cur = { ...cur, y: cur.y - 12 };
  }

  cur = drawReportTable(
    doc,
    cur,
    [
      { key: "axis", header: "Eixo", width: contentWidth() * 0.45 },
      { key: "maturity", header: "Maturidade", width: contentWidth() * 0.55 },
    ],
    axes.map((ax) => ({
      axis: ax.axisName,
      maturity:
        ax.maturityLevel == null
          ? "Sem critérios aplicáveis"
          : reportLevelLabel(ax.maturityLevel),
    })),
  );

  return cur;
}
