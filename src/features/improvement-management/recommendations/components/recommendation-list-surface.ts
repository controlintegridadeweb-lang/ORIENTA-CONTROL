import {
  axisThemeKeyForName,
  getAxisTheme,
  type AxisThemeKey,
} from "@/shared/theme/axis-theme";

export type RecommendationAxisSurface = {
  key: AxisThemeKey | "neutral";
  accent: string;
  soft: string;
  label: string;
};

const NEUTRAL: RecommendationAxisSurface = {
  key: "neutral",
  accent: "#0F766E",
  soft: "#E7F3F2",
  label: "#D8ECEA",
};

/** Superfície visual do eixo — tokens compartilhados (`getAxisTheme`). */
export function recommendationAxisSurface(axisName: string): RecommendationAxisSurface {
  const key = axisThemeKeyForName(axisName);
  if (!key) return NEUTRAL;
  const theme = getAxisTheme(axisName);
  return {
    key,
    accent: theme.primary,
    soft: theme.softBackground,
    label: theme.softBackground,
  };
}

/** Casca do card de recomendação — vida sem quebrar o design system. */
export const recommendationCardShell = {
  article:
    "group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card",
  body: "flex flex-col gap-5 p-4 sm:gap-5 sm:p-5",
  accentRail: "absolute inset-y-0 left-0 w-1 transition-colors duration-200",
  guidancePanel:
    "rounded-lg px-3.5 py-3 transition-colors duration-200 sm:px-4 sm:py-3.5",
  trackingDivider: "space-y-4 border-t border-slate-200/70 pt-4",
  actions: "flex flex-wrap justify-end gap-2",
} as const;

/** Cabeçalhos da hierarquia Eixo → Seção. */
export const recommendationHierarchySurface = {
  stack: "space-y-10 sm:space-y-12",
  axisBlock: "space-y-6 sm:space-y-8",
  axisHeader:
    "relative overflow-hidden rounded-r-xl border-l-4 border-slate-200 py-3 pl-5 pr-4 sm:py-3.5",
  axisEyebrow:
    "text-xs font-medium text-slate-500",
  axisTitle:
    "mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl",
  sectionBlock: "space-y-4 sm:space-y-5",
  sectionHeader:
    "flex items-center gap-3 border-b border-slate-200/70 pb-2",
  sectionAccent: "h-5 w-1 shrink-0 rounded-full",
  sectionTitle: "text-base font-semibold text-slate-800 sm:text-lg",
  cards: "flex flex-col gap-4 sm:gap-5",
} as const;
