"use client";

import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { reportCatalogLabels } from "@/shared/labels/official-labels";
import type { ReportCatalogKind } from "@/features/reports/report-catalog";

type Variant = "no-reports" | "no-filter-results";

function emptyBody(kind: "" | ReportCatalogKind): string {
  if (kind === "annual") return reportCatalogLabels.emptyAnnualDescription;
  if (kind === "bimonthly") return reportCatalogLabels.emptyBimonthlyDescription;
  return reportCatalogLabels.emptyDescription;
}

type Props = {
  variant: Variant;
  kind?: "" | ReportCatalogKind;
  originHref?: string | null;
};

export function RespondentReportsEmptyState({
  variant,
  kind = "",
  originHref,
}: Props) {
  if (variant === "no-filter-results") {
    return (
      <div className={formSurface.empty.container}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <SearchX className="h-6 w-6 text-slate-500" aria-hidden />
        </span>
        <p className={formSurface.empty.title}>Nenhum resultado encontrado</p>
        <p className={formSurface.empty.description}>
          Ajuste a busca, o tipo de relatório ou o período para ampliar os resultados.
        </p>
      </div>
    );
  }

  return (
    <div className={formSurface.empty.container}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Inbox className="h-6 w-6 text-slate-500" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>{reportCatalogLabels.emptyTitle}</p>
      <p className={formSurface.empty.description}>{emptyBody(kind)}</p>
      {kind === "annual" || !originHref ? null : (
        <Link href={originHref} className={formSurface.secondaryButtonSm}>
          {reportCatalogLabels.bimonthlyOriginCta}
        </Link>
      )}
    </div>
  );
}
