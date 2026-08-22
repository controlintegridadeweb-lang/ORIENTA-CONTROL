/**
 * Paleta e layout dos cinco níveis de maturidade FAMI.
 * Card único: badge no topo → cabeçalho colorido → ilustração → rodapé com divisor.
 */

export type MaturityLevelVariantKey =
  | "initial"
  | "developing"
  | "intermediate"
  | "advanced"
  | "mature";

export type MaturityLevelVariant = {
  /** Fundo do cabeçalho e do badge numérico. */
  header: string;
  /** Texto do cabeçalho (nome e faixa). */
  headerText: string;
  /** Borda do card. */
  border: string;
  divider: string;
  text: string;
  badge: string;
  accent: string;
  hover: string;
  ring: string;
  iconColor: string;
  iconBg: string;
};

/** Cores da referência visual da jornada FAMI. */
export const maturityLevelVariants: Record<MaturityLevelVariantKey, MaturityLevelVariant> = {
  initial: {
    header: "bg-[#E12456]",
    headerText: "text-white",
    border: "border-slate-200",
    divider: "border-slate-200",
    text: "text-[#E12456]",
    badge: "border border-[#E12456]/30 bg-[#E12456]/10 text-[#B01B44]",
    accent: "bg-[#E12456]",
    hover: "hover:border-slate-300 hover:shadow-md",
    ring: "stroke-[#E12456]",
    iconBg: "bg-[#E12456]/10",
    iconColor: "text-[#B01B44]",
  },
  developing: {
    header: "bg-[#C3681D]",
    headerText: "text-white",
    border: "border-slate-200",
    divider: "border-slate-200",
    text: "text-[#C3681D]",
    badge: "border border-[#C3681D]/30 bg-[#C3681D]/10 text-[#8F4B14]",
    accent: "bg-[#C3681D]",
    hover: "hover:border-slate-300 hover:shadow-md",
    ring: "stroke-[#C3681D]",
    iconBg: "bg-[#C3681D]/10",
    iconColor: "text-[#8F4B14]",
  },
  intermediate: {
    header: "bg-[#007AC3]",
    headerText: "text-white",
    border: "border-slate-200",
    divider: "border-slate-200",
    text: "text-[#007AC3]",
    badge: "border border-[#007AC3]/30 bg-[#007AC3]/10 text-[#005F97]",
    accent: "bg-[#007AC3]",
    hover: "hover:border-slate-300 hover:shadow-md",
    ring: "stroke-[#007AC3]",
    iconBg: "bg-[#007AC3]/10",
    iconColor: "text-[#005F97]",
  },
  advanced: {
    header: "bg-[#663300]",
    headerText: "text-white",
    border: "border-slate-200",
    divider: "border-slate-200",
    text: "text-[#663300]",
    badge: "border border-[#663300]/30 bg-[#663300]/10 text-[#663300]",
    accent: "bg-[#663300]",
    hover: "hover:border-slate-300 hover:shadow-md",
    ring: "stroke-[#663300]",
    iconBg: "bg-[#663300]/10",
    iconColor: "text-[#663300]",
  },
  mature: {
    header: "bg-[#009669]",
    headerText: "text-white",
    border: "border-slate-200",
    divider: "border-slate-200",
    text: "text-[#009669]",
    badge: "border border-[#009669]/30 bg-[#009669]/10 text-[#007A55]",
    accent: "bg-[#009669]",
    hover: "hover:border-slate-300 hover:shadow-md",
    ring: "stroke-[#009669]",
    iconBg: "bg-[#009669]/10",
    iconColor: "text-[#007A55]",
  },
};

/**
 * Estrutura única do card — proporções da referência (~30% header / ~50% arte / ~20% rodapé).
 * O badge numérico fica majoritariamente sobre o cabeçalho, com uma fatia acima da borda.
 */
export const MATURITY_LEVEL_CARD_LAYOUT = {
  /** Wrapper externo reserva espaço para o badge que ultrapassa o topo. */
  wrap: "relative flex h-full w-full flex-col pt-6",
  article:
    "relative flex h-full w-full flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-200",
  badge:
    "absolute left-1/2 top-0 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-[32%] items-center justify-center rounded-full text-2xl font-bold tabular-nums text-white shadow-sm ring-2 ring-white",
  currentTag:
    "absolute right-2 top-2.5 z-20 rounded-full bg-white px-2.5 py-0.5 text-2xs font-semibold text-sky-700 shadow-sm",
  header:
    "relative flex min-h-[9.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-t-[0.7rem] px-2.5 pb-5 pt-9 text-center",
  title: "px-1 text-center text-[17px] font-bold leading-snug",
  range: "mt-0.5 px-1 text-center text-[13px] italic leading-snug text-white/95",
  body: "flex min-h-0 flex-1 flex-col rounded-b-[0.7rem] bg-white",
  imageArea: "relative mx-auto aspect-square w-full max-h-52 flex-1 shrink-0 bg-white sm:max-h-56",
  image: "object-contain p-1.5",
  description:
    "flex min-h-[4.25rem] shrink-0 items-center justify-center border-t border-slate-200 px-2.5 py-3",
  descriptionText:
    "text-center text-[11px] italic leading-snug break-words text-slate-700 sm:text-xs",
} as const;

export const MATURITY_LEVEL_VARIANT_KEY: Record<1 | 2 | 3 | 4 | 5, MaturityLevelVariantKey> = {
  1: "initial",
  2: "developing",
  3: "intermediate",
  4: "advanced",
  5: "mature",
};

export function maturityLevelVariant(level: 1 | 2 | 3 | 4 | 5): MaturityLevelVariant {
  return maturityLevelVariants[MATURITY_LEVEL_VARIANT_KEY[level]];
}

/** Destaque do nível atual — borda azul clara em volta do card inteiro. */
export const MATURITY_LEVEL_SELECTED = "border-sky-300 shadow-md ring-1 ring-sky-200";
