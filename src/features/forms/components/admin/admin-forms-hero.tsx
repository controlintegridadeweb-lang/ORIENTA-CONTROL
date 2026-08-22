import Link from "next/link";
import { Plus } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { FORM_WORKSPACE_HERO_IMAGE } from "@/shared/config/page-assets/form-workspace-hero-image";
import { formSurface } from "@/shared/layout/form-surface";

export function AdminFormulariosHero() {
  return (
    <IllustratedPageHero
      theme="admin"
      ariaLabel="Formulários"
      overline="Gestão de formulários"
      title="Formulários"
      description="Crie modelos pelo assistente de publicação e acompanhe os formulários disponíveis para novos diagnósticos."
      image={FORM_WORKSPACE_HERO_IMAGE}
      imageClassName="relative z-1 h-auto w-full max-w-120 object-contain object-bottom sm:max-w-136 lg:max-h-76 lg:max-w-168 lg:object-center xl:max-h-84 xl:max-w-184"
      priority
      actions={
        <Link href="/admin/formularios/novo" className={formSurface.primaryButtonSm}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Novo formulário
        </Link>
      }
    />
  );
}
