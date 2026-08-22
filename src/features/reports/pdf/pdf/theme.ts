import { rgb, type RGB } from "pdf-lib";
import { getAxisTheme } from "@/shared/theme/axis-theme";

/** Identidade visual Orienta — tons suaves para PDF institucional. */
export const reportTheme = {
  page: { w: 595, h: 842 },
  margin: 56,
  footerH: 32,
  line: 16,
  sectionGap: 22,
  /** Altura mínima reservada após título de seção (evita órfãos). */
  titleBlockH: 78,
  minContentAfterTitle: 100,
  brand: rgb(0.39, 0.67, 0.58),
  brandDark: rgb(0.04, 0.48, 0.44),
  brandLight: rgb(0.94, 0.98, 0.96),
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
  amber: rgb(0.75, 0.45, 0.1),
  amberBg: rgb(1, 0.97, 0.92),
  rose: rgb(0.78, 0.22, 0.28),
  roseBg: rgb(1, 0.95, 0.95),
  /** Fundo editorial da capa */
  coverBg: rgb(0.97, 0.98, 0.98),
  coverInk: rgb(0.12, 0.14, 0.16),
  coverInkMuted: rgb(0.42, 0.46, 0.5),
  coverGeoDark: rgb(0.06, 0.32, 0.36),
  coverGeoMid: rgb(0.12, 0.55, 0.52),
  coverGeoLight: rgb(0.62, 0.72, 0.66),
  coverGeoAccent: rgb(0.22, 0.68, 0.62),
} as const;

function pdfRgbFromHex(hex: string): RGB {
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
  softBackground: RGB;
  border: RGB;
} {
  const theme = getAxisTheme(axisName);
  return {
    primary: pdfRgbFromHex(theme.primary),
    softBackground: pdfRgbFromHex(theme.softBackground),
    border: pdfRgbFromHex(theme.border),
  };
}

export function contentWidth(): number {
  return reportTheme.page.w - reportTheme.margin * 2;
}
