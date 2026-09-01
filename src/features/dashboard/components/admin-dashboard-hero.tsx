import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";

const HERO_IMAGE = "/assets/admin-dashboard-hero.png";

export function AdminDashboardHero() {
  return (
    <IllustratedPageHero
      theme="admin"
      size="tall"
      ariaLabel="Dashboard administrativo"
      overline="Painel administrativo"
      title="Dashboard administrativo"
      description="Acompanhe diagnósticos, evidências, recomendações, planos de integridade e compliance e indicadores institucionais."
      image={HERO_IMAGE}
      loading="lazy"
    />
  );
}
