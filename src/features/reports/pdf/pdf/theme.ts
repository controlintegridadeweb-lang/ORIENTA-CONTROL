import { rgb, type RGB } from "pdf-lib";
import { getAxisTheme } from "@/shared/theme/axis-theme";

/** Identidade visual Orienta — tons institucionais para PDF. */
export const reportTheme = {
  page: { w: 595, h: 842 },
  margin: 52,
  footerH: 36,
  line: 16,
  sectionGap: 22,
  /** Altura mínima reservada após título de seção (evita órfãos). */
  titleBlockH: 78,
  minContentAfterTitle: 100,
  brand: rgb(0.18, 0.55, 0.5),
  brandDark: rgb(0.12, 0.42, 0.4),
  brandLight: rgb(0.94, 0.98, 0.96),
  brandAccent: rgb(0.91, 0.59, 0.43),
  slate900: rgb(0.06, 0.09, 0.16),
  slate700: rgb(0.2, 0.27, 0.33),
  slate600: rgb(0.28, 0.33, 0.41),
  slate500: rgb(0.39, 0.45, 0.52),
  slate200: rgb(0.89, 0.91, 0.94),
  slate100: rgb(0.95, 0.96, 0.98),
  white: rgb(1, 1, 1),
  emerald: rgb(0.16, 0.65, 0.45),
  emeraldBg: rgb(0.93, 0.99, 0.96),
  sky: rgb(0.12, 0.45, 0.78),
  skyBg: rgb(0.94, 0.97, 1),
  /** Cabeçalho de tabela — mesmo tom escuro das tags (`brand-700`). */
  tableHeader: rgb(15 / 255, 147 / 255, 135 / 255),
  tableStripe: rgb(250 / 255, 250 / 255, 250 / 255),
  /** Card de resumo da seção (referência “Pontuação do critério”). */
  sectionSummaryCard: rgb(234 / 255, 246 / 255, 249 / 255),
  gridInk: rgb(0, 0, 0),
  /** Fundo das células-rótulo (negrito) da grade de critério. */
  gridLabelBg: rgb(238 / 255, 247 / 255, 251 / 255),
  amber: rgb(0.75, 0.45, 0.1),
  amberBg: rgb(1, 0.97, 0.92),
  rose: rgb(0.78, 0.22, 0.28),
  roseBg: rgb(1, 0.95, 0.95),
  coverInk: rgb(0.12, 0.35, 0.33),
  coverInkMuted: rgb(0.35, 0.42, 0.42),
  /** Moldura institucional da página de sumário (referência visual). */
  tocFrame: rgb(19 / 255, 145 / 255, 133 / 255),
  /** Badge “Nível N” do card FAMI — token `brand-400`. */
  brandBadge: rgb(100 / 255, 172 / 255, 149 / 255),
  /** Arco do anel percentual (emerald-500 da UI). */
  scoreRing: rgb(16 / 255, 185 / 255, 129 / 255),
  scoreRingTrack: rgb(226 / 255, 232 / 255, 240 / 255),
} as const;

export function pdfRgbFromHex(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}

/**
 * Identidade dos eixos no PDF. Reutiliza a mesma fonte de verdade visual da UI
 * para evitar Governança/Ambiental/Social com paletas divergentes entre telas e relatórios.
 */
export function reportAxisTheme(axisName: string): {
  primary: RGB;
  strong: RGB;
  softBackground: RGB;
  border: RGB;
  text: RGB;
} {
  const theme = getAxisTheme(axisName);
  return {
    primary: pdfRgbFromHex(theme.primary),
    strong: pdfRgbFromHex(theme.strong),
    softBackground: pdfRgbFromHex(theme.softBackground),
    border: pdfRgbFromHex(theme.border),
    text: pdfRgbFromHex(theme.text),
  };
}

const MATURITY_LEVEL_PDF: Record<
  1 | 2 | 3 | 4 | 5,
  { bg: RGB; text: RGB }
> = {
  1: {
    bg: rgb(225 / 255, 36 / 255, 86 / 255),
    text: reportTheme.white,
  },
  2: {
    bg: rgb(195 / 255, 104 / 255, 29 / 255),
    text: reportTheme.white,
  },
  3: {
    bg: rgb(0 / 255, 122 / 255, 195 / 255),
    text: reportTheme.white,
  },
  4: {
    bg: rgb(102 / 255, 51 / 255, 0 / 255),
    text: reportTheme.white,
  },
  5: {
    bg: rgb(0 / 255, 150 / 255, 105 / 255),
    text: reportTheme.white,
  },
};

export function reportMaturityLevelTheme(level: number | null): {
  bg: RGB;
  text: RGB;
} {
  if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) {
    return MATURITY_LEVEL_PDF[level];
  }
  return { bg: reportTheme.slate600, text: reportTheme.white };
}

export function contentWidth(): number {
  return reportTheme.page.w - reportTheme.margin * 2;
}
