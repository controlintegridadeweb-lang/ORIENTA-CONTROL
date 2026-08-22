"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { RespondentProgress } from "@/features/respondent-progress";
import { RespondentFormsYearEmptyState } from "@/features/workbench";
import { RespondentFormProgressItem } from "@/features/workbench";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  forms: RespondentProgress[];
  totalForms: number;
  year: number;
  loading?: boolean;
};

export function RespondentDashboardFormsPanel({
  forms,
  totalForms,
  year,
  loading = false,
}: Props) {
  const diagnosesHref = `/respondente/formularios?year=${encodeURIComponent(String(year))}`;

  return (
    <>
      <SectionHeader
        size="compact"
        title="Prioridades"
        description="O que precisa da sua atenção agora."
        actions={
          <Link
            href={diagnosesHref}
            className={`${typography.inlineNavLink} italic font-normal text-slate-600 hover:text-slate-900`}
          >
            Ver todos os diagnósticos
          </Link>
        }
      />

      {forms.length === 0 ? (
        totalForms > 0 && !loading ? (
          <div className="border-t border-slate-200 pt-4">
            <div className={formSurface.empty.container}>
              <span className={formSurface.empty.iconWrap}>
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <p className={formSurface.empty.title}>
                Você não possui nenhuma pendência no momento.
              </p>
              <p className={formSurface.empty.description}>
                Os diagnósticos deste ano estão sem ação pendente. O histórico completo permanece em
                Meus diagnósticos.
              </p>
              <Link
                href={diagnosesHref}
                className={`${typography.inlineNavLink} italic font-normal text-slate-600 hover:text-slate-900`}
              >
                Ver meus diagnósticos
              </Link>
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 pt-4">
            <RespondentFormsYearEmptyState year={year} loading={loading} />
          </div>
        )
      ) : (
        <ul className="space-y-3 border-t border-slate-200 pt-4">
          {forms.map((form) => (
            <RespondentFormProgressItem
              key={form.cycleId}
              form={form}
              variant="card"
              contextYear={year}
            />
          ))}
        </ul>
      )}
    </>
  );
}
