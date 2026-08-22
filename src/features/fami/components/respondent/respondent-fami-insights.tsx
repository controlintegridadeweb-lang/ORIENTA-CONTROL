"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FamiInsightCard } from "@/features/fami/respondent-presentation";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";

type PriorityCta = {
  href: string;
  label: string;
};

type Props = {
  summary: string;
  cards: FamiInsightCard[];
  priorityCta?: PriorityCta | null;
};

const KIND_LABEL: Record<FamiInsightCard["kind"], string> = {
  strength: "Ponto forte",
  weakness: "Ponto crítico",
  opportunity: "Prioridade",
  risk: "Risco Institucional",
  neutral: "Leitura",
};

/** Cabeçalho saturado + borda na mesma cor (referência visual). */
const KIND_STYLE: Record<
  FamiInsightCard["kind"],
  { header: string; border: string }
> = {
  strength: {
    header: "bg-emerald-600",
    border: "border-emerald-600",
  },
  weakness: {
    header: "bg-rose-600",
    border: "border-rose-600",
  },
  opportunity: {
    header: "bg-sky-600",
    border: "border-sky-600",
  },
  risk: {
    header: "bg-amber-500",
    border: "border-amber-500",
  },
  neutral: {
    header: "bg-slate-600",
    border: "border-slate-600",
  },
};

export function RespondentFamiInsights({ summary, cards, priorityCta }: Props) {
  return (
    <PanelSection
      title="Leitura do resultado"
      description={summary}
      variant="plain"
    >
      <div className="space-y-4">
        {cards.length > 0 ? (
          <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const style = KIND_STYLE[card.kind];
              return (
                <li key={card.id} className="flex h-full min-w-0">
                  <article
                    className={`flex h-full w-full flex-col overflow-hidden rounded-xl border ${style.border} bg-white shadow-sm`}
                  >
                    <header
                      className={`${style.header} px-4 py-3.5 text-center text-lg font-bold text-white`}
                    >
                      {KIND_LABEL[card.kind]}
                    </header>
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-5 text-center">
                      <p className="text-base font-bold leading-snug text-slate-950">
                        {card.title}
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">
                        {card.description}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={`${formSurface.dashboardPanel} px-5 py-4 text-sm text-slate-500 sm:px-6`}>
            Ainda há poucos dados para gerar interpretações.
          </p>
        )}

        {priorityCta ? (
          <div className="flex justify-start sm:justify-end">
            <Link href={priorityCta.href} className={formSurface.primaryButtonSm}>
              {priorityCta.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </PanelSection>
  );
}
