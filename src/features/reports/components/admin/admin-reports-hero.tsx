import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_RELATORIOS_HERO_IMAGE } from "@/shared/config/page-assets/admin-relatorios-hero-image";

export function AdminReportsHero() {
  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Relatórios"
      overline="Catálogo de documentos"
      title="Relatórios"
      description="Emita o relatório anual dos diagnósticos concluídos e consulte também os relatórios bimestrais já gerados."
      image={ADMIN_RELATORIOS_HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      imageSizes="(max-width: 1024px) 95vw, 520px"
      imageClassName="relative z-1 h-auto w-full max-w-72 object-contain object-center sm:max-w-80 lg:max-h-80 lg:max-w-96 xl:max-h-88 xl:max-w-104"
      mediaClassName="bg-white"
      priority
    />
  );
}
