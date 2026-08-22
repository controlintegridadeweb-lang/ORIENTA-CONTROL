"use client";

import Link from "next/link";
import { ArrowUp, BadgeCheck, CheckCircle2, FileSearch, Inbox, X } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

type Variant =
  | "nothing-sent"
  | "no-pendency"
  | "no-approved"
  | "no-results"
  | "history-in-inbox";

type Props = {
  variant: Variant;
  onClearFilters?: () => void;
  onViewAll?: () => void;
  hasActiveFilters?: boolean;
};

const COPY: Record<
  Variant,
  {
    icon: typeof Inbox;
    title: string;
    description: string;
    primary?: { href: string; label: string };
  }
> = {
  "nothing-sent": {
    icon: Inbox,
    title: "Você ainda não enviou nenhuma evidência",
    description:
      "Quando uma pergunta exigir comprovação, envie o arquivo ou o link no próprio formulário. Os registros aparecerão aqui automaticamente.",
    primary: { href: "/respondente/formularios", label: "Ir para meus diagnósticos" },
  },
  "no-pendency": {
    icon: CheckCircle2,
    title: "Nenhuma pendência por enquanto",
    description:
      "Sempre que a equipe solicitar ajuste ou comprovação, a pendência aparecerá aqui com a justificativa.",
  },
  "no-approved": {
    icon: BadgeCheck,
    title: "Nenhuma evidência aprovada ainda",
    description:
      "Quando suas evidências forem validadas, elas aparecerão neste recorte como aprovadas.",
  },
  "no-results": {
    icon: FileSearch,
    title: "Nenhum resultado para os filtros aplicados",
    description: "Ajuste a busca, o período ou limpe os filtros para ver mais evidências.",
  },
  "history-in-inbox": {
    icon: ArrowUp,
    title: "Nenhuma evidência neste histórico",
    description:
      "As evidências que precisam de correção estão na aba Ajustes solicitados. Aqui ficam os envios já avaliados ou aguardando validação.",
  },
};

export function RespondentEvidenceEmptyState({ variant, onClearFilters, onViewAll, hasActiveFilters }: Props) {
  const c = COPY[variant];
  const Icon = c.icon;
  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>{c.title}</p>
      <p className={formSurface.empty.description}>{c.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {variant === "no-results" && hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className={formSurface.secondaryButtonSm}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar filtros
          </button>
        ) : null}
        {variant === "no-pendency" && onViewAll ? (
          <button type="button" onClick={onViewAll} className={formSurface.primaryButtonSm}>
            Ver todas as evidências
          </button>
        ) : null}
        {c.primary ? (
          <Link href={c.primary.href} className={formSurface.primaryButtonSm}>
            {c.primary.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
