import Link from "next/link";
import { Plus } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_CICLOS_HERO_IMAGE } from "@/shared/config/page-assets/admin-ciclos-hero-image";
import { formSurface } from "@/shared/layout/form-surface";

type Props = { formId?: string };

export function AdminCiclosHero({ formId = "" }: Props) {
  const newHref = formId
    ? `/admin/ciclos/novo?formId=${encodeURIComponent(formId)}`
    : "/admin/ciclos/novo";

  return (
    <IllustratedPageHero
      theme="admin"
      size="compact"
      ariaLabel="Situação dos órgãos"
      overline="Acompanhamento operacional"
      title="Situação dos órgãos"
      description="Acompanhe os órgãos no formulário selecionado."
      image={ADMIN_CICLOS_HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      quality={100}
      imageSizes="(max-width: 1024px) 95vw, 520px"
      imageClassName="relative z-1 h-auto w-full max-w-72 object-contain object-center sm:max-w-80 lg:max-h-80 lg:max-w-96 xl:max-h-88 xl:max-w-104"
      mediaClassName="bg-white"
      priority
      actions={
        <Link href={newHref} className={formSurface.primaryButtonSm}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Novo diagnóstico
        </Link>
      }
    />
  );
}
