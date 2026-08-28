import type { RGB } from "pdf-lib";
import type { Cursor, OrientaPdfDocument } from "./document";
import { contentWidth, reportTheme } from "./theme";

export function statusLabelPt(status: string): string {
  const map: Record<string, string> = {
    generated: "Gerada",
    in_action_plan: "Em execução",
    awaiting_approval: "Execução concluída — aguardando aceite",
    adjustment_requested: "Ajuste solicitado",
    exception_requested: "Exceção em análise",
    completed: "Aprovada",
    dismissed: "Dispensada",
    not_started: "Não iniciado",
    in_progress: "Em andamento",
    cancelled: "Cancelada",
    approved: "Aprovada",
    pending: "Pendente",
    submitted: "Enviada",
    invalidated: "Não aprovada",
    not_required: "Não exigida",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function drawBadge(
  doc: OrientaPdfDocument,
  page: Cursor["page"],
  x: number,
  y: number,
  label: string,
  colors: { bg: RGB; text: RGB },
): number {
  const pad = 6;
  const size = 8;
  const w = doc.fonts.bold.widthOfTextAtSize(label, size) + pad * 2;
  const h = 14;
  drawPill(page, x, y - 12, w, h, colors.bg);
  page.drawText(label, {
    x: x + pad,
    y: y - 10,
    size,
    font: doc.fonts.bold,
    color: colors.text,
  });
  return w + 6;
}

function drawPill(
  page: Cursor["page"],
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB,
): void {
  const radius = height / 2;
  page.drawCircle({ x: x + radius, y: y + radius, size: radius, color });
  page.drawCircle({
    x: x + width - radius,
    y: y + radius,
    size: radius,
    color,
  });
  page.drawRectangle({
    x: x + radius,
    y,
    width: Math.max(0, width - height),
    height,
    color,
  });
}

export function drawFilledPill(
  page: Cursor["page"],
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGB,
): void {
  drawPill(page, x, y, width, height, color);
}

export function drawProgressBar(
  page: Cursor["page"],
  x: number,
  y: number,
  width: number,
  pct: number,
  fillColor = reportTheme.brand,
  barHeight = 8,
): void {
  const h = barHeight;
  const clamped = Math.max(0, Math.min(100, pct));
  page.drawRectangle({
    x,
    y: y - h,
    width,
    height: h,
    color: reportTheme.slate100,
  });
  if (clamped > 0) {
    page.drawRectangle({
      x,
      y: y - h,
      width: (width * clamped) / 100,
      height: h,
      color: fillColor,
    });
  }
}

export function drawKpiTile(
  doc: OrientaPdfDocument,
  c: Cursor,
  opts: {
    label: string;
    value: string;
    sub?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    accent?: RGB;
  },
): void {
  const { page } = c;
  page.drawRectangle({
    x: opts.x,
    y: opts.y - opts.h,
    width: opts.w,
    height: opts.h,
    color: reportTheme.white,
    borderColor: reportTheme.slate200,
    borderWidth: 0.75,
  });
  if (opts.accent) {
    page.drawRectangle({
      x: opts.x,
      y: opts.y - 3,
      width: opts.w,
      height: 3,
      color: opts.accent,
    });
  }
  page.drawText(opts.label, {
    x: opts.x + 10,
    y: opts.y - 22,
    size: 8,
    font: doc.fonts.regular,
    color: reportTheme.slate500,
  });
  page.drawText(opts.value, {
    x: opts.x + 10,
    y: opts.y - 40,
    size: 18,
    font: doc.fonts.bold,
    color: reportTheme.slate900,
  });
  if (opts.sub) {
    page.drawText(opts.sub, {
      x: opts.x + 10,
      y: opts.y - opts.h + 12,
      size: 8,
      font: doc.fonts.regular,
      color: reportTheme.slate500,
      maxWidth: opts.w - 20,
    });
  }
}

export function drawMiniBarChart(
  doc: OrientaPdfDocument,
  c: Cursor,
  items: Array<{ label: string; value: number; color?: RGB }>,
  chartH = 100,
): Cursor {
  const w = contentWidth();
  const barAreaH = chartH - 24;
  const cur = doc.ensureSpace(c, chartH + 16);
  const baseY = cur.y - barAreaH - 8;
  const gap = 12;
  const barW = Math.min(48, (w - gap * (items.length + 1)) / Math.max(items.length, 1));
  const startX = reportTheme.margin + gap;

  items.forEach((item, i) => {
    const x = startX + i * (barW + gap);
    const barH = (barAreaH * Math.min(100, item.value)) / 100;
    cur.page.drawRectangle({
      x,
      y: baseY,
      width: barW,
      height: barH,
      color: item.color ?? reportTheme.brand,
    });
    cur.page.drawText(`${item.value.toFixed(0)}%`, {
      x,
      y: baseY + barH + 4,
      size: 8,
      font: doc.fonts.bold,
      color: reportTheme.slate700,
      maxWidth: barW,
    });
    const labelLines = doc.chunkText(item.label, 12);
    labelLines.slice(0, 2).forEach((ln, li) => {
      cur.page.drawText(ln, {
        x,
        y: baseY - 14 - li * 10,
        size: 7,
        font: doc.fonts.regular,
        color: reportTheme.slate500,
        maxWidth: barW + 8,
      });
    });
  });

  return { page: cur.page, y: baseY - 36 };
}

/** Sparkline simples (linha) para evolução anual. */
export function drawSparkline(
  doc: OrientaPdfDocument,
  c: Cursor,
  values: number[],
  width: number,
  height: number,
): Cursor {
  if (values.length < 2) return c;
  const cur = doc.ensureSpace(c, height + 20);
  const x0: number = reportTheme.margin;
  const y0 = cur.y - height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  let px: number = x0;
  let py: number = y0 + ((values[0]! - min) / range) * height;
  for (let i = 1; i < values.length; i++) {
    const nx = x0 + step * i;
    const ny = y0 + ((values[i]! - min) / range) * height;
    cur.page.drawLine({
      start: { x: px, y: py },
      end: { x: nx, y: ny },
      thickness: 2,
      color: reportTheme.brandDark,
    });
    cur.page.drawCircle({ x: nx, y: ny, size: 2.5, color: reportTheme.brand });
    px = nx;
    py = ny;
  }
  return { page: cur.page, y: y0 - 16 };
}

export function recommendationAccent(type: string): { bg: RGB; text: RGB; border: RGB } {
  const t = type.toLowerCase();
  if (t === "risk" || t === "weakness") {
    return { bg: reportTheme.rose, text: reportTheme.white, border: reportTheme.rose };
  }
  if (t === "opportunity" || t === "strength") {
    return { bg: reportTheme.emerald, text: reportTheme.white, border: reportTheme.emerald };
  }
  return { bg: reportTheme.sky, text: reportTheme.white, border: reportTheme.sky };
}

export { drawRoundedRectFill } from "@/shared/export/pdf-rounded-rect";
