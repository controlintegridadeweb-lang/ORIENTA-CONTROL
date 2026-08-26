import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_USUARIOS_HERO_IMAGE } from "@/shared/config/page-assets/admin-usuarios-hero-image";

export function AdminUsuariosHero() {
  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Usuários"
      overline="Acessos e perfis"
      title="Usuários"
      description="Crie e gerencie respondentes: edite nome, e-mail e organização vinculada, solicite a recuperação de senha ou remova contas. O perfil Respondente é fixo nesta área."
      image={ADMIN_USUARIOS_HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      imageSizes="(max-width: 1024px) 95vw, 520px"
      imageClassName="relative z-1 h-auto w-full max-w-72 object-contain object-center sm:max-w-80 lg:max-h-80 lg:max-w-96 xl:max-h-88 xl:max-w-104"
      mediaClassName="bg-white"
      priority
    />
  );
}
