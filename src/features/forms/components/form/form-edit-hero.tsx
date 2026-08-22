import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { FormPublicationStateBadge } from "@/features/forms/components/form/form-publication-state-badge";
import type { FormPublicationState } from "@/features/forms/form-publication-state";
import { FORM_WORKSPACE_HERO_IMAGE } from "@/shared/config/page-assets/form-workspace-hero-image";

type Props = {
  formName: string;
  state: FormPublicationState;
  backHref: string;
  backLabel: string;
};

export function FormEditHero({ formName, state, backHref, backLabel }: Props) {
  return (
    <IllustratedPageHero
      theme="admin"
      ariaLabel={formName}
      overline="Gestão do formulário"
      title={formName}
      description="Consulte a configuração publicada, inclua organizações e acompanhe os diagnósticos vinculados."
      image={FORM_WORKSPACE_HERO_IMAGE}
      imageClassName="relative z-1 h-auto w-full max-w-120 object-contain object-bottom sm:max-w-136 lg:max-h-76 lg:max-w-168 lg:object-center xl:max-h-84 xl:max-w-184"
      priority
      beforeContent={
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/40"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
      }
    >
      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-5">
        <FormPublicationStateBadge state={state} />
      </div>
    </IllustratedPageHero>
  );
}
