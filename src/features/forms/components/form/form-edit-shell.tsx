import type { ReactNode } from "react";
import { FormEditHero } from "@/features/forms/components/form/form-edit-hero";
import { FormTabs } from "@/features/forms/components/form/form-tabs";
import type { FormPublicationState } from "@/features/forms/form-publication-state";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  formId: string;
  formName: string;
  state: FormPublicationState;
  backHref: string;
  backLabel: string;
  scope?: "admin";
  showTabs?: boolean;
  children: ReactNode;
};

/** Shell das telas internas do formulário — hero institucional, abas e conteúdo. */
export function FormEditShell({
  formId,
  formName,
  state,
  backHref,
  backLabel,
  scope = "admin",
  showTabs = true,
  children,
}: Props) {
  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <article className={`${formSurface.card} overflow-hidden`}>
          <FormEditHero
            formName={formName}
            state={state}
            backHref={backHref}
            backLabel={backLabel}
          />
          {showTabs ? <FormTabs formId={formId} scope={scope} state={state} embedded /> : null}
          <div className="bg-white px-4 py-5 sm:px-6 sm:py-6 md:px-7">{children}</div>
        </article>
      </div>
    </div>
  );
}
