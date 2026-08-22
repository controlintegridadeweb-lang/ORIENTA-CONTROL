import type { ReactNode } from "react";
import { AdminNewFormHero } from "@/features/forms/components/admin/admin-new-form-hero";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { FormWizardStepper } from "./form-wizard-stepper";
import type { FormWizardStepId } from "./form-wizard-steps";

type Props = {
  backHref: string;
  backLabel?: string;
  formName?: string;
  currentStep: FormWizardStepId;
  maxReachableStep: FormWizardStepId;
  onStepSelect?: (step: FormWizardStepId) => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shell do assistente linear de criação/publicação de formulário. */
export function FormWizardShell({
  backHref,
  backLabel,
  formName,
  currentStep,
  maxReachableStep,
  onStepSelect,
  children,
  footer,
}: Props) {
  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <article className={`${formSurface.card} overflow-hidden`}>
          <AdminNewFormHero
            backHref={backHref}
            backLabel={backLabel}
            title={formName ? formName : undefined}
            subtitle={
              formName
                ? "Assistente de publicação — o formulário permanece em rascunho até você publicar."
                : undefined
            }
          />
          <FormWizardStepper
            currentStep={currentStep}
            maxReachableStep={maxReachableStep}
            onStepSelect={onStepSelect}
          />
          <div className="bg-white px-4 py-5 sm:px-6 sm:py-6 md:px-7">{children}</div>
          {footer ? (
            <footer className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-stone-50 px-4 py-3 sm:px-6 md:px-7">
              {footer}
            </footer>
          ) : null}
        </article>
      </div>
    </div>
  );
}
