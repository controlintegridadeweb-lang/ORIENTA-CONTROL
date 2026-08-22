import { AdminFormulariosHero } from "@/features/forms/components/admin/admin-forms-hero";
import { FormsList } from "@/features/forms/components/form/forms-list";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

/** Página de listagem de formulários do administrador. */
export function AdminFormulariosSection() {
  return (
    <div className={layout.pageStack}>
      <div className={ADMIN_PAGE_HERO_BLEED}>
        <AdminFormulariosHero />
      </div>

      <div className={`${layout.pageStack} pt-1`}>
        <section className={layout.sectionStack} aria-label="Modelos cadastrados">
          <SectionHeader
            title="Modelos cadastrados"
            description="Publique quando as perguntas e suas configurações estiverem completas."
          />
          <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
            <FormsList />
          </div>
        </section>
      </div>
    </div>
  );
}
