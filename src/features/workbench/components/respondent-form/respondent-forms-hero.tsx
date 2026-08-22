import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { FORM_WORKSPACE_HERO_IMAGE } from "@/shared/config/page-assets/form-workspace-hero-image";

export function RespondentFormulariosHero() {
  return (
    <IllustratedPageHero
      theme="respondent"
      size="compact"
      ariaLabel="Meus diagnósticos"
      overline="Área de resposta"
      title="Meus diagnósticos"
      description="Responda, acompanhe ajustes e consulte o histórico completo dos diagnósticos da sua organização."
      image={FORM_WORKSPACE_HERO_IMAGE}
      priority
    />
  );
}
