import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_ORGANIZACOES_HERO_IMAGE } from "@/shared/config/page-assets/admin-organizacoes-hero-image";

export function AdminOrganizacoesHero() {
  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Organizações"
      overline="Cadastro institucional"
      title="Organizações"
      description="Cadastre e consulte as organizações avaliadas. Cada respondente pertence a exatamente uma organização; administradores têm visão global."
      image={ADMIN_ORGANIZACOES_HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      imageSizes="(max-width: 1024px) 95vw, 520px"
      imageClassName="relative z-1 h-auto w-full max-w-72 object-contain object-center sm:max-w-80 lg:max-h-80 lg:max-w-96 xl:max-h-88 xl:max-w-104"
      mediaClassName="bg-white"
      priority
    />
  );
}
