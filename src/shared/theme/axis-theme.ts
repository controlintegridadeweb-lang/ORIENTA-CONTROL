import { normalizeAxisNameKey } from "@/shared/domain/axis";

/**
 * Identidade visual dos eixos estruturais da plataforma.
 * Fonte única — UI de recomendações/plano de ação e FAMI consomem daqui.
 */

export type AxisThemeKey = "governance" | "environmental" | "social";

export { normalizeAxisNameKey } from "@/shared/domain/axis";

export type AxisTheme = {
  key: AxisThemeKey;
  primary: string;
  softBackground: string;
  border: string;
  text: string;
};

/** Tons claros e bordas em hex sólido — sem rgba nem gradiente. */
const AXIS_THEMES = {
  governance: {
    key: "governance",
    primary: "#0097B2",
    softBackground: "#E5F4F7",
    border: "#A6DAE4",
    text: "#0097B2",
  },
  environmental: {
    key: "environmental",
    primary: "#16A34A",
    softBackground: "#E8F6EE",
    border: "#A8D9B9",
    text: "#16A34A",
  },
  social: {
    key: "social",
    primary: "#DB2777",
    softBackground: "#FBE9F1",
    border: "#F0A8C8",
    text: "#DB2777",
  },
} as const satisfies Record<AxisThemeKey, AxisTheme>;

const NEUTRAL_THEME: AxisTheme = {
  key: "governance",
  primary: "#0F766E",
  softBackground: "#E7F3F2",
  border: "#A7CBC7",
  text: "#0F766E",
};

const KEY_BY_NORMALIZED: Record<string, AxisThemeKey> = {
  governanca: "governance",
  ambiental: "environmental",
  social: "social",
};


export function axisThemeKeyForName(axisName: string): AxisThemeKey | undefined {
  return KEY_BY_NORMALIZED[normalizeAxisNameKey(axisName)];
}

/**
 * Tokens visuais do eixo. Sempre retorna um tema utilizável
 * (fallback institucional quando o nome não é estrutural).
 */
export function getAxisTheme(axisName: string | null | undefined): AxisTheme {
  if (!axisName?.trim()) return NEUTRAL_THEME;
  const key = axisThemeKeyForName(axisName);
  return key ? AXIS_THEMES[key] : NEUTRAL_THEME;
}

/** Tema tipado quando o eixo é estrutural; senão `undefined`. */
export function getAxisThemeStrict(axisName: string): AxisTheme | undefined {
  const key = axisThemeKeyForName(axisName);
  return key ? AXIS_THEMES[key] : undefined;
}

/** Tokens visuais canônicos quando a chave estrutural já é conhecida. */
export function getAxisThemeByKey(key: AxisThemeKey): AxisTheme {
  return AXIS_THEMES[key];
}

export const AXIS_THEME_FALLBACK_PRIMARY = NEUTRAL_THEME.primary;
