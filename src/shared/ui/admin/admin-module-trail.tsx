"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  adminPlanoAcaoHref,
  adminRecomendacoesHref,
} from "@/shared/navigation/admin-paths";
import { adminReturnPathOrFallback, withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";

type Props = {
  recommendationId: string;
  /** Superfície do documento da recomendação (a trilha não aparece no Plano de ação). */
  active: "recommendation" | "plan";
};

function tabLinkClass(active: boolean): string {
  return `inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-medium transition ${
    active
      ? "bg-brand text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;
}

/**
 * Troca entre o documento da recomendação e o workspace do plano.
 *
 * No Plano de ação, Visão geral / Ações / Monitoramento são as únicas abas —
 * esta trilha fica só na superfície da recomendação.
 */
export function AdminModuleTrail({ recommendationId, active }: Props) {
  const searchParams = useSearchParams();
  const returnTo = adminReturnPathOrFallback(searchParams.get("returnTo"), "/admin/recomendacoes");
  const activeModule = active;

  const steps = [
    {
      id: "recommendation" as const,
      label: "Recomendação",
      href: withAdminReturnPath(adminRecomendacoesHref(recommendationId), returnTo),
    },
    {
      id: "plan" as const,
      label: "Plano de ação",
      href: withAdminReturnPath(adminPlanoAcaoHref(recommendationId), returnTo),
    },
  ];

  return (
    <nav
      aria-label="Módulos desta recomendação"
      className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      <ol className="flex flex-wrap gap-1" role="tablist">
        {steps.map((step) => {
          const isActive = step.id === activeModule;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={tabLinkClass(isActive)}
                role="tab"
                aria-current={isActive ? "page" : undefined}
              >
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
