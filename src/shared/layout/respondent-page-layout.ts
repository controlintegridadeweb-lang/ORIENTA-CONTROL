import {
  PAGE_HERO_BLEED,
  PAGE_HERO_CLASS,
  PAGE_HERO_IMAGE_COMPACT,
  PAGE_HERO_IMAGE_SIZES_COMPACT,
  PAGE_HERO_LAYOUT_COMPACT,
  PAGE_HERO_MEDIA_COMPACT,
} from "@/shared/layout/page-hero-layout";

export const RESPONDENT_PAGE_HERO_BLEED = PAGE_HERO_BLEED;
export const RESPONDENT_PAGE_HERO_CLASS = PAGE_HERO_CLASS;

export const RESPONDENT_PAGE_HERO_OVERLINE =
  "text-sm font-medium text-slate-500";

export const RESPONDENT_PAGE_HERO_TITLE =
  "mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl";

export const RESPONDENT_PAGE_HERO_DESCRIPTION =
  "mt-2 max-w-xl text-sm font-normal leading-relaxed text-slate-600 md:text-base";

/** Área de ações abaixo da descrição (botões, links). */
export const RESPONDENT_PAGE_HERO_ACTIONS =
  "mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3";

/** Layout compacto — evidências, recomendações, formulários. */
export const RESPONDENT_PAGE_HERO_LAYOUT_COMPACT = PAGE_HERO_LAYOUT_COMPACT;

export const RESPONDENT_PAGE_HERO_CONTENT_COMPACT =
  "flex min-w-0 flex-1 flex-col justify-center px-5 py-6 sm:px-7 sm:py-7 lg:max-w-[50%] lg:px-8 lg:py-7 xl:px-9";

export const RESPONDENT_PAGE_HERO_MEDIA_COMPACT = PAGE_HERO_MEDIA_COMPACT;
export const RESPONDENT_PAGE_HERO_IMAGE_COMPACT = PAGE_HERO_IMAGE_COMPACT;
export const RESPONDENT_PAGE_HERO_IMAGE_SIZES_COMPACT = PAGE_HERO_IMAGE_SIZES_COMPACT;

/** Layout alto — dashboard e relatórios. */
export const RESPONDENT_PAGE_HERO_LAYOUT_TALL =
  "relative flex flex-col lg:min-h-96 lg:flex-row lg:items-stretch xl:min-h-104";

export const RESPONDENT_PAGE_HERO_CONTENT_TALL =
  "flex min-w-0 flex-1 flex-col justify-center px-5 py-8 sm:px-7 sm:py-9 lg:max-w-[40%] lg:px-8 lg:py-10 xl:px-10";

export const RESPONDENT_PAGE_HERO_MEDIA_TALL =
  "relative flex min-h-80 flex-1 items-end justify-center px-0 pb-0 pt-2 sm:min-h-88 lg:min-h-0 lg:items-end lg:justify-end lg:px-2 lg:pb-0 lg:pt-0 xl:pr-4";

export const RESPONDENT_PAGE_HERO_IMAGE_TALL =
  "relative z-1 h-auto w-full max-w-136 object-contain object-bottom sm:max-w-152 lg:max-h-104 lg:max-w-184 lg:object-bottom xl:max-h-112 xl:max-w-208 2xl:max-h-120 2xl:max-w-224";

export const RESPONDENT_PAGE_HERO_IMAGE_SIZES_TALL = "(max-width: 1024px) 95vw, 720px";
