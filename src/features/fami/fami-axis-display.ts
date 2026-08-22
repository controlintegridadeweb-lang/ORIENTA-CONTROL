import { structuralAxisOrderIndex } from "@/shared/domain/axis";
import type { AxisMaturity } from "@/features/fami/types";
import {
  axisThemeKeyForName,
  getAxisThemeStrict,
  getAxisThemeByKey,
  AXIS_THEME_FALLBACK_PRIMARY,
  type AxisThemeKey,
} from "@/shared/theme/axis-theme";

export type AxisColorKey = AxisThemeKey;

export {
  axisThemeKeyForName as axisColorKeyForName,
} from "@/shared/theme/axis-theme";

/**
 * Paleta de apresentação por eixo estrutural.
 * Fonte canônica: `@/shared/theme/axis-theme`.
 */
function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function presentationColorsForKey(key: AxisColorKey) {
  const theme = getAxisThemeByKey(key);
  return {
    text: theme.text,
    badge: theme.softBackground,
    accent: theme.primary,
    row: withAlpha(theme.primary, 0.04),
  } as const;
}

export const AXIS_COLORS = {
  governance: presentationColorsForKey("governance"),
  environmental: presentationColorsForKey("environmental"),
  social: presentationColorsForKey("social"),
} as const satisfies Record<
  AxisColorKey,
  { text: string; badge: string; accent: string; row: string }
>;

/** Atalho para a cor sólida do eixo (gráficos, marcadores). */
export const FAMI_AXIS_COLORS = {
  governance: AXIS_COLORS.governance.accent,
  environmental: AXIS_COLORS.environmental.accent,
  social: AXIS_COLORS.social.accent,
} as const;

/** Tokens de cor do eixo; `undefined` quando o nome não é estrutural. */
export function axisColorsForName(axisName: string) {
  const key = axisThemeKeyForName(axisName);
  return key ? AXIS_COLORS[key] : undefined;
}

/** Cor sólida de apresentação do eixo; `undefined` quando o nome não é estrutural. */
export function colorForAxisName(axisName: string): string | undefined {
  return getAxisThemeStrict(axisName)?.primary;
}

/** Fallback institucional (brand) para eixos não estruturais em gráficos. */
export const AXIS_COLOR_FALLBACK = AXIS_THEME_FALLBACK_PRIMARY;

/** Cor sólida para gráficos — paleta oficial ou fallback. */
export function colorForAxisNameOrFallback(axisName: string): string {
  return colorForAxisName(axisName) ?? AXIS_COLOR_FALLBACK;
}

export { structuralAxisOrderIndex } from "@/shared/domain/axis";

/**
 * Ordena eixos pela sequência institucional (Governanca → Ambiental → Social).
 * Eixos não reconhecidos vão para o fim, mantendo ordem alfabética estável.
 */
export function sortAxesMaturity(axes: AxisMaturity[]): AxisMaturity[] {
  return [...axes].sort((a, b) => {
    const diff = structuralAxisOrderIndex(a.axisName) - structuralAxisOrderIndex(b.axisName);
    if (diff !== 0) return diff;
    return a.axisName.localeCompare(b.axisName, "pt-BR");
  });
}
