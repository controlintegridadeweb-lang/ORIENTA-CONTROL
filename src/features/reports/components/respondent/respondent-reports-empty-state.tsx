"use client";

import { Inbox, SearchX } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { reportCatalogLabels } from "@/shared/labels/official-labels";

type Variant = "no-reports" | "no-filter-results";

const CFG: Record<
  Variant,
  { icon: typeof Inbox; title: string; body: string; iconBg: string; iconColor: string }
> = {
  "no-reports": {
    icon: Inbox,
    title: reportCatalogLabels.emptyTitle,
    body: reportCatalogLabels.emptyDescription,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
  },
  "no-filter-results": {
    icon: SearchX,
    title: "Nenhum resultado encontrado",
    body: "Ajuste a busca, o tipo de relatório ou o período para ampliar os resultados.",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
  },
};

export function RespondentReportsEmptyState({ variant }: { variant: Variant }) {
  const cfg = CFG[variant];
  const Icon = cfg.icon;
  return (
    <div className={formSurface.empty.container}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${cfg.iconBg}`}>
        <Icon className={`h-6 w-6 ${cfg.iconColor}`} aria-hidden />
      </span>
      <p className={formSurface.empty.title}>{cfg.title}</p>
      <p className={formSurface.empty.description}>{cfg.body}</p>
    </div>
  );
}
