"use client";

import Link from "next/link";
import { Filter, Inbox, Lightbulb, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

export type EmptyVariant =
  | "no-recommendations"
  | "no-results"
  | "no-plan-linked"
  | "awaiting-consolidation";

type VariantDef = {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: { label: string; href?: string; onClick?: () => void };
};

type Props = {
  variant: EmptyVariant;
  onClearFilters?: () => void;
};

export function RespondentRecommendationEmptyState({ variant, onClearFilters }: Props) {
  const defs: Record<EmptyVariant, VariantDef> = {
    "no-recommendations": {
      icon: Lightbulb,
      title: "Este diagnóstico ainda não possui recomendações",
      description:
        "As recomendações oficiais da Plataforma ORIENTA aparecem depois que a administração valida e consolida o diagnóstico.",
      cta: { label: "Ir para meus diagnósticos", href: "/respondente/formularios" },
    },
    "no-results": {
      icon: Filter,
      title: "Nenhuma recomendação corresponde aos filtros atuais",
      description:
        "Há recomendações no portfólio, mas nenhuma combina com a busca ou os filtros selecionados. Ajuste ou limpe os filtros para continuar.",
      cta: onClearFilters
        ? { label: "Limpar filtros", onClick: onClearFilters }
        : undefined,
    },
    "no-plan-linked": {
      icon: ListChecks,
      title: "Nenhuma recomendação vinculada a plano",
      description:
        "Há recomendações consolidadas sem ações cadastradas. Inicie o plano de ação para acompanhar progresso, início e final.",
      cta: {
        label: "Ver pendentes de ação",
        href: "/respondente/portfolio-recomendacoes?focus=awaiting_action",
      },
    },
    "awaiting-consolidation": {
      icon: ListChecks,
      title: "Aguardando consolidação do diagnóstico",
      description:
        "Existem recomendações, mas o plano de ação só será liberado depois que a administração validar e consolidar o diagnóstico correspondente.",
      cta: {
        label: "Ir para meus diagnósticos",
        href: "/respondente/formularios",
      },
    },
  };

  const def = defs[variant];
  const Icon = def.icon ?? Inbox;
  const cta = def.cta;

  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>{def.title}</p>
      <p className={formSurface.empty.description}>{def.description}</p>
      {cta ? (
        cta.href ? (
          <Link href={cta.href} className={`${formSurface.secondaryButtonSm} mt-2`}>
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className={`${formSurface.secondaryButtonSm} mt-2`}
          >
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
}
