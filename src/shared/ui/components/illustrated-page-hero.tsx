import Image, { type ImageProps } from "next/image";
import type { ReactNode } from "react";
import {
  ADMIN_PAGE_HERO_ACTIONS,
  ADMIN_PAGE_HERO_CLASS,
  ADMIN_PAGE_HERO_CONTENT,
  ADMIN_PAGE_HERO_CONTENT_CREATE,
  ADMIN_PAGE_HERO_CONTENT_TALL,
  ADMIN_PAGE_HERO_DESCRIPTION,
  ADMIN_PAGE_HERO_IMAGE,
  ADMIN_PAGE_HERO_IMAGE_COMPACT,
  ADMIN_PAGE_HERO_IMAGE_CREATE,
  ADMIN_PAGE_HERO_IMAGE_SIZES,
  ADMIN_PAGE_HERO_IMAGE_SIZES_COMPACT,
  ADMIN_PAGE_HERO_IMAGE_SIZES_CREATE,
  ADMIN_PAGE_HERO_IMAGE_TALL,
  ADMIN_PAGE_HERO_LAYOUT,
  ADMIN_PAGE_HERO_LAYOUT_COMPACT,
  ADMIN_PAGE_HERO_LAYOUT_CREATE,
  ADMIN_PAGE_HERO_LAYOUT_TALL,
  ADMIN_PAGE_HERO_MEDIA,
  ADMIN_PAGE_HERO_MEDIA_COMPACT,
  ADMIN_PAGE_HERO_MEDIA_CREATE,
  ADMIN_PAGE_HERO_MEDIA_TALL,
  ADMIN_PAGE_HERO_OVERLINE,
  ADMIN_PAGE_HERO_TITLE,
} from "@/shared/layout/admin-page-layout";
import {
  RESPONDENT_PAGE_HERO_ACTIONS,
  RESPONDENT_PAGE_HERO_CLASS,
  RESPONDENT_PAGE_HERO_CONTENT_COMPACT,
  RESPONDENT_PAGE_HERO_CONTENT_TALL,
  RESPONDENT_PAGE_HERO_DESCRIPTION,
  RESPONDENT_PAGE_HERO_IMAGE_COMPACT,
  RESPONDENT_PAGE_HERO_IMAGE_SIZES_COMPACT,
  RESPONDENT_PAGE_HERO_IMAGE_SIZES_TALL,
  RESPONDENT_PAGE_HERO_IMAGE_TALL,
  RESPONDENT_PAGE_HERO_LAYOUT_COMPACT,
  RESPONDENT_PAGE_HERO_LAYOUT_TALL,
  RESPONDENT_PAGE_HERO_MEDIA_COMPACT,
  RESPONDENT_PAGE_HERO_MEDIA_TALL,
  RESPONDENT_PAGE_HERO_OVERLINE,
  RESPONDENT_PAGE_HERO_TITLE,
} from "@/shared/layout/respondent-page-layout";

type HeroTheme = "admin" | "respondent";
type HeroSize = "standard" | "compact" | "tall" | "create";

type Props = {
  theme: HeroTheme;
  size?: HeroSize;
  ariaLabel: string;
  overline: ReactNode;
  title: ReactNode;
  description: ReactNode;
  image: ImageProps["src"];
  actions?: ReactNode;
  beforeContent?: ReactNode;
  children?: ReactNode;
  priority?: boolean;
  loading?: ImageProps["loading"];
  quality?: number;
  unoptimized?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  imageClassName?: string;
  mediaClassName?: string;
  imageSizes?: string;
};

function heroClasses(theme: HeroTheme, size: HeroSize) {
  if (theme === "respondent") {
    const tall = size === "tall";
    return {
      header: RESPONDENT_PAGE_HERO_CLASS,
      layout: tall ? RESPONDENT_PAGE_HERO_LAYOUT_TALL : RESPONDENT_PAGE_HERO_LAYOUT_COMPACT,
      content: tall ? RESPONDENT_PAGE_HERO_CONTENT_TALL : RESPONDENT_PAGE_HERO_CONTENT_COMPACT,
      media: tall ? RESPONDENT_PAGE_HERO_MEDIA_TALL : RESPONDENT_PAGE_HERO_MEDIA_COMPACT,
      image: tall ? RESPONDENT_PAGE_HERO_IMAGE_TALL : RESPONDENT_PAGE_HERO_IMAGE_COMPACT,
      sizes: tall ? RESPONDENT_PAGE_HERO_IMAGE_SIZES_TALL : RESPONDENT_PAGE_HERO_IMAGE_SIZES_COMPACT,
      overline: RESPONDENT_PAGE_HERO_OVERLINE,
      title: RESPONDENT_PAGE_HERO_TITLE,
      description: RESPONDENT_PAGE_HERO_DESCRIPTION,
      actions: RESPONDENT_PAGE_HERO_ACTIONS,
    };
  }

  if (size === "tall") {
    return {
      header: ADMIN_PAGE_HERO_CLASS,
      layout: ADMIN_PAGE_HERO_LAYOUT_TALL,
      content: ADMIN_PAGE_HERO_CONTENT_TALL,
      media: ADMIN_PAGE_HERO_MEDIA_TALL,
      image: ADMIN_PAGE_HERO_IMAGE_TALL,
      sizes: ADMIN_PAGE_HERO_IMAGE_SIZES,
      overline: ADMIN_PAGE_HERO_OVERLINE,
      title: ADMIN_PAGE_HERO_TITLE,
      description: ADMIN_PAGE_HERO_DESCRIPTION,
      actions: ADMIN_PAGE_HERO_ACTIONS,
    };
  }

  if (size === "compact") {
    return {
      header: ADMIN_PAGE_HERO_CLASS,
      layout: ADMIN_PAGE_HERO_LAYOUT_COMPACT,
      content: ADMIN_PAGE_HERO_CONTENT,
      media: ADMIN_PAGE_HERO_MEDIA_COMPACT,
      image: ADMIN_PAGE_HERO_IMAGE_COMPACT,
      sizes: ADMIN_PAGE_HERO_IMAGE_SIZES_COMPACT,
      overline: ADMIN_PAGE_HERO_OVERLINE,
      title: ADMIN_PAGE_HERO_TITLE,
      description: ADMIN_PAGE_HERO_DESCRIPTION,
      actions: ADMIN_PAGE_HERO_ACTIONS,
    };
  }

  if (size === "create") {
    return {
      header: ADMIN_PAGE_HERO_CLASS,
      layout: ADMIN_PAGE_HERO_LAYOUT_CREATE,
      content: ADMIN_PAGE_HERO_CONTENT_CREATE,
      media: ADMIN_PAGE_HERO_MEDIA_CREATE,
      image: ADMIN_PAGE_HERO_IMAGE_CREATE,
      sizes: ADMIN_PAGE_HERO_IMAGE_SIZES_CREATE,
      overline: ADMIN_PAGE_HERO_OVERLINE,
      title: ADMIN_PAGE_HERO_TITLE,
      description: ADMIN_PAGE_HERO_DESCRIPTION,
      actions: ADMIN_PAGE_HERO_ACTIONS,
    };
  }

  return {
    header: ADMIN_PAGE_HERO_CLASS,
    layout: ADMIN_PAGE_HERO_LAYOUT,
    content: ADMIN_PAGE_HERO_CONTENT,
    media: ADMIN_PAGE_HERO_MEDIA,
    image: ADMIN_PAGE_HERO_IMAGE,
    sizes: ADMIN_PAGE_HERO_IMAGE_SIZES,
    overline: ADMIN_PAGE_HERO_OVERLINE,
    title: ADMIN_PAGE_HERO_TITLE,
    description: ADMIN_PAGE_HERO_DESCRIPTION,
    actions: ADMIN_PAGE_HERO_ACTIONS,
  };
}

/** Estrutura visual única para os heróis institucionais da plataforma. */
export function IllustratedPageHero({
  theme,
  size = "standard",
  ariaLabel,
  overline,
  title,
  description,
  image,
  actions,
  beforeContent,
  children,
  priority,
  loading,
  quality,
  unoptimized,
  imageWidth = 800,
  imageHeight = 560,
  imageClassName,
  mediaClassName,
  imageSizes,
}: Props) {
  const classes = heroClasses(theme, size);

  return (
    <header className={classes.header} aria-label={ariaLabel}>
      <div className={classes.layout}>
        <div className={classes.content}>
          {beforeContent}
          <p className={classes.overline}>{overline}</p>
          <h1 className={classes.title}>{title}</h1>
          <p className={classes.description}>{description}</p>
          {children}
          {actions ? <div className={classes.actions}>{actions}</div> : null}
        </div>

        <div className={`${classes.media} ${mediaClassName ?? ""}`.trim()}>
          <Image
            src={image}
            alt=""
            width={imageWidth}
            height={imageHeight}
            priority={priority}
            loading={priority ? undefined : loading}
            quality={quality}
            unoptimized={unoptimized}
            sizes={imageSizes ?? classes.sizes}
            className={imageClassName ?? classes.image}
          />
        </div>
      </div>
    </header>
  );
}
