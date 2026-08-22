import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ADMIN_PAGE_HERO_DESCRIPTION } from "@/shared/layout/admin-page-layout";
import { typography } from "@/shared/layout/design-system";

type Props = {
  backHref: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
};

export function AdminNewFormHero({
  backHref,
  backLabel = "Voltar para a lista",
  title = "Novo formulário",
  subtitle = "Crie um modelo em rascunho, configure as perguntas e publique quando estiver pronto.",
}: Props) {
  return (
    <header className="px-4 pt-5 pb-6 sm:px-6 sm:pt-6 md:px-7" aria-label="Novo formulário">
      <Link
        href={backHref}
        className={typography.inlineNavLink}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>
      <h1 className={`mt-4 ${typography.pageTitle}`}>{title}</h1>
      <p className={ADMIN_PAGE_HERO_DESCRIPTION}>{subtitle}</p>
    </header>
  );
}
