"use client";

import { CheckCircle2, Hourglass, Inbox } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

type Kind = "no-snapshot" | "no-completed-cycle" | "no-history" | "no-data";

const CONFIG: Record<
  Kind,
  {
    icon: typeof Inbox;
    title: string;
    description: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  "no-snapshot": {
    icon: Hourglass,
    title: "Sua maturidade ainda não foi calculada",
    description:
      "O resultado FAMI oficial é gerado quando a administração conclui a validação do formulário. Para este diagnóstico, o processamento ainda não está disponível.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "no-completed-cycle": {
    icon: Inbox,
    title: "Nenhum resultado FAMI disponível",
    description:
      "Envie o diagnóstico e acompanhe a validação. O Resultado FAMI ficará disponível assim que a administração concluir essa etapa.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
  "no-history": {
    icon: CheckCircle2,
    title: "Sem histórico de evolução",
    description:
      "Após o segundo processamento será possível comparar a evolução da sua maturidade.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-700",
  },
  "no-data": {
    icon: Inbox,
    title: "Dados insuficientes para análise",
    description:
      "O processamento validado não possui dados suficientes para uma leitura FAMI completa. Consulte o relatório oficial ou entre em contato com a administração.",
    iconBg: "bg-slate-50",
    iconColor: "text-slate-500",
  },
};

type Props = {
  kind: Kind;
  /** Filtragem anual ativa mas sem dados de fechamento daquele ano (BRT) */
  yearFiltered?: number | null;
};

export function RespondentFamiEmptyState({ kind, yearFiltered }: Props) {
  const cfg = CONFIG[kind];
  const Icon = cfg.icon;
  const useYearFiltered =
    kind === "no-snapshot" && yearFiltered != null && Number.isFinite(yearFiltered);
  const title = useYearFiltered
    ? `Nenhum processamento FAMI em ${yearFiltered}`
    : cfg.title;
  const description = useYearFiltered
    ? "Experimente “Todos os anos” ou outro exercício disponível para ver o último fechamento disponível."
    : cfg.description;
  return (
    <section className={formSurface.empty.container}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${cfg.iconBg}`}>
        <Icon className={`h-6 w-6 ${cfg.iconColor}`} aria-hidden />
      </span>
      <p className={formSurface.empty.title}>{title}</p>
      <p className={formSurface.empty.description}>{description}</p>
    </section>
  );
}
