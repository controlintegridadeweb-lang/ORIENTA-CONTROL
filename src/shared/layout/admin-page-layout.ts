import {
  PAGE_HERO_BLEED,
  PAGE_HERO_CLASS,
  PAGE_HERO_IMAGE_COMPACT,
  PAGE_HERO_IMAGE_SIZES_COMPACT,
  PAGE_HERO_LAYOUT_COMPACT,
  PAGE_HERO_MEDIA_COMPACT,
} from "@/shared/layout/page-hero-layout";

export const ADMIN_PAGE_HERO_BLEED = PAGE_HERO_BLEED;
export const ADMIN_PAGE_HERO_CLASS = PAGE_HERO_CLASS;

export const ADMIN_PAGE_HERO_OVERLINE =
  "text-sm font-medium text-slate-500";

export const ADMIN_PAGE_HERO_TITLE =
  "mt-2 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl";

export const ADMIN_PAGE_HERO_DESCRIPTION =
  "mt-2 max-w-xl text-sm font-normal leading-relaxed text-slate-600 md:text-base";

export const ADMIN_PAGE_HERO_ACTIONS =
  "mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3";

export const ADMIN_PAGE_HERO_LAYOUT =
  "relative flex flex-col lg:min-h-64 lg:flex-row lg:items-center xl:min-h-72";

export const ADMIN_PAGE_HERO_CONTENT =
  "flex min-w-0 flex-1 flex-col justify-center px-5 py-6 sm:px-7 sm:py-7 lg:max-w-[50%] lg:px-8 lg:py-8 xl:px-9";

export const ADMIN_PAGE_HERO_MEDIA =
  "relative flex min-h-48 flex-1 items-end justify-center px-2 pb-0 pt-2 sm:min-h-56 lg:min-h-0 lg:items-center lg:justify-end lg:px-3 lg:pt-0 xl:pr-4";

export const ADMIN_PAGE_HERO_IMAGE =
  "relative z-1 h-auto w-full max-w-104 object-contain object-bottom sm:max-w-120 lg:max-h-72 lg:max-w-160 lg:object-center xl:max-h-80 xl:max-w-176";

export const ADMIN_PAGE_HERO_IMAGE_SIZES = "(max-width: 1024px) 95vw, 640px";

/** Ilustração compacta (formulários, checklist). */
export const ADMIN_PAGE_HERO_IMAGE_COMPACT = PAGE_HERO_IMAGE_COMPACT;
export const ADMIN_PAGE_HERO_IMAGE_SIZES_COMPACT = PAGE_HERO_IMAGE_SIZES_COMPACT;

/** Layout compacto — evidências, formulários internos. */
export const ADMIN_PAGE_HERO_LAYOUT_COMPACT = PAGE_HERO_LAYOUT_COMPACT;
export const ADMIN_PAGE_HERO_MEDIA_COMPACT = PAGE_HERO_MEDIA_COMPACT;

/** Hero alto reservado ao dashboard, onde a ilustração tem função de boas-vindas. */
export const ADMIN_PAGE_HERO_LAYOUT_TALL =
  "relative flex flex-col lg:min-h-76 lg:flex-row lg:items-stretch xl:min-h-88";

export const ADMIN_PAGE_HERO_CONTENT_TALL =
  "flex min-w-0 flex-1 flex-col justify-center px-5 py-8 sm:px-7 sm:py-9 lg:max-w-[44%] lg:px-8 lg:py-10 xl:px-10";

export const ADMIN_PAGE_HERO_MEDIA_TALL =
  "relative flex min-h-68 flex-1 items-end justify-center px-2 pb-0 pt-3 sm:min-h-80 lg:min-h-0 lg:items-end lg:justify-end lg:px-3 lg:pt-0 xl:pr-4";

export const ADMIN_PAGE_HERO_IMAGE_TALL =
  "relative z-1 h-auto w-full max-w-120 object-contain object-bottom sm:max-w-136 lg:max-h-88 lg:max-w-168 lg:object-bottom xl:max-h-96 xl:max-w-192 2xl:max-h-104 2xl:max-w-208";

/** Hero enxuto para fluxos de criação ou configuração pontual (ex.: novo formulário). */
export const ADMIN_PAGE_HERO_LAYOUT_CREATE =
  "relative flex flex-col lg:min-h-0 lg:flex-row lg:items-center";

export const ADMIN_PAGE_HERO_CONTENT_CREATE =
  "flex min-w-0 flex-1 flex-col justify-center px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8 xl:px-9";

export const ADMIN_PAGE_HERO_MEDIA_CREATE =
  "relative flex min-h-38 flex-1 items-end justify-center px-2 pb-0 pt-1 sm:min-h-42 lg:min-h-0 lg:max-w-[44%] lg:items-center lg:justify-end lg:px-4 lg:pb-2 lg:pt-0";

export const ADMIN_PAGE_HERO_IMAGE_CREATE =
  "relative z-1 h-auto w-full max-w-68 object-contain object-bottom sm:max-w-76 lg:max-h-38 lg:max-w-60 lg:object-center xl:max-h-42 xl:max-w-68";

export const ADMIN_PAGE_HERO_IMAGE_SIZES_CREATE = "(max-width: 1024px) 88vw, 400px";
