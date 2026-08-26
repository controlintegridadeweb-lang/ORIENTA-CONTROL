import type { ReactNode } from "react";
import Image from "next/image";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { FORM_WORKSPACE_HERO_IMAGE } from "@/shared/config/page-assets/form-workspace-hero-image";
import {
  ADMIN_PAGE_HERO_BLEED,
  ADMIN_PAGE_HERO_CLASS,
  ADMIN_PAGE_HERO_CONTENT,
  ADMIN_PAGE_HERO_DESCRIPTION,
  ADMIN_PAGE_HERO_IMAGE_COMPACT,
  ADMIN_PAGE_HERO_IMAGE_SIZES_COMPACT,
  ADMIN_PAGE_HERO_LAYOUT_COMPACT,
  ADMIN_PAGE_HERO_MEDIA_COMPACT,
  ADMIN_PAGE_HERO_OVERLINE,
  ADMIN_PAGE_HERO_TITLE,
} from "@/shared/layout/admin-page-layout";
import {
  RESPONDENT_PAGE_HERO_BLEED,
  RESPONDENT_PAGE_HERO_CLASS,
  RESPONDENT_PAGE_HERO_CONTENT_COMPACT,
  RESPONDENT_PAGE_HERO_DESCRIPTION,
  RESPONDENT_PAGE_HERO_IMAGE_COMPACT,
  RESPONDENT_PAGE_HERO_IMAGE_SIZES_COMPACT,
  RESPONDENT_PAGE_HERO_LAYOUT_COMPACT,
  RESPONDENT_PAGE_HERO_MEDIA_COMPACT,
  RESPONDENT_PAGE_HERO_OVERLINE,
  RESPONDENT_PAGE_HERO_TITLE,
} from "@/shared/layout/respondent-page-layout";

type Props = {
  title: string;
  description: string;
  roleLabel?: string;
  /** Alinha o hero ao padrão visual da área (admin ou respondente). */
  variant?: "admin" | "respondent";
  children: ReactNode;
};

/**
 * Cabeçalho do perfil reutilizando o mesmo hero institucional das demais telas
 * (overline + título + descrição + ilustração, em bleed), variando apenas o
 * conjunto de tokens conforme a área para manter a consistência visual.
 */
export function ProfileShell({
  title,
  description,
  roleLabel,
  variant = "admin",
  children,
}: Props) {
  const hero =
    variant === "respondent"
      ? {
          bleed: RESPONDENT_PAGE_HERO_BLEED,
          cls: RESPONDENT_PAGE_HERO_CLASS,
          layout: RESPONDENT_PAGE_HERO_LAYOUT_COMPACT,
          content: RESPONDENT_PAGE_HERO_CONTENT_COMPACT,
          overline: RESPONDENT_PAGE_HERO_OVERLINE,
          title: RESPONDENT_PAGE_HERO_TITLE,
          description: RESPONDENT_PAGE_HERO_DESCRIPTION,
          media: RESPONDENT_PAGE_HERO_MEDIA_COMPACT,
          image: RESPONDENT_PAGE_HERO_IMAGE_COMPACT,
          sizes: RESPONDENT_PAGE_HERO_IMAGE_SIZES_COMPACT,
        }
      : {
          bleed: ADMIN_PAGE_HERO_BLEED,
          cls: ADMIN_PAGE_HERO_CLASS,
          layout: ADMIN_PAGE_HERO_LAYOUT_COMPACT,
          content: ADMIN_PAGE_HERO_CONTENT,
          overline: ADMIN_PAGE_HERO_OVERLINE,
          title: ADMIN_PAGE_HERO_TITLE,
          description: ADMIN_PAGE_HERO_DESCRIPTION,
          media: ADMIN_PAGE_HERO_MEDIA_COMPACT,
          image: ADMIN_PAGE_HERO_IMAGE_COMPACT,
          sizes: ADMIN_PAGE_HERO_IMAGE_SIZES_COMPACT,
        };

  return (
    <div className={layout.pageStack}>
      <div className={hero.bleed}>
        <header className={hero.cls} aria-label={title}>
          <div className={hero.layout}>
            <div className={hero.content}>
              <p className={hero.overline}>Conta e acesso</p>
              <h1 className={hero.title}>{title}</h1>
              <p className={hero.description}>{description}</p>
              {roleLabel ? (
                <div className="mt-5">
                  <span className={`${formSurface.badge.base} ${formSurface.badge.brand}`}>
                    {roleLabel}
                  </span>
                </div>
              ) : null}
            </div>

            <div className={hero.media}>
              <Image
                src={FORM_WORKSPACE_HERO_IMAGE}
                alt=""
                width={800}
                height={560}
                priority
                sizes={hero.sizes}
                className={hero.image}
              />
            </div>
          </div>
        </header>
      </div>

      {children}
    </div>
  );
}
