"use client";

import { FamiScoreRing } from "@/features/fami/components/admin/fami-score-ring";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { formatFamiUpdatedAt } from "@/features/fami/format-updated-at";
import { levelMeta } from "@/features/fami/respondent-presentation";
import { RespondentFamiLevelBadge } from "./respondent-fami-level-badge";

type Props = {
  percentage: number | null;
  level: number | null;
  lastProcessedAt: string | null;
};

/**
 * Resultado oficial: badge + nome do nível + atualização à esquerda; anel % à direita.
 */
export function RespondentFamiScopeBanner({
  percentage,
  level,
  lastProcessedAt,
}: Props) {
  const hasCalculatedResult = percentage != null;
  const isNotApplicable = hasCalculatedResult && level == null;
  const meta = level != null ? levelMeta(level) : null;

  return (
    <PanelSection
      title="Resultado do diagnóstico"
      description="Percentual e nível oficiais do processamento selecionado."
      variant="plain"
    >
      <div
        className={`flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}
        role="status"
      >
        {hasCalculatedResult && level != null && percentage != null && meta ? (
          <>
            <div className="min-w-0 space-y-2">
              <span className="inline-flex rounded-md bg-brand-400 px-2.5 py-1 text-xs font-semibold text-white">
                Nível {meta.level}
              </span>
              <p className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                {meta.shortLabel}
              </p>
              <p className="text-sm italic text-slate-500">
                Atualizado:{" "}
                <time dateTime={lastProcessedAt ?? undefined}>
                  {formatFamiUpdatedAt(lastProcessedAt)}
                </time>
              </p>
            </div>

            <FamiScoreRing
              percentage={percentage}
              level={level}
              emphasizePercent
              ringTone="brand"
            />
          </>
        ) : isNotApplicable ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <RespondentFamiLevelBadge level={null} size="md" />
              <p className="text-sm leading-relaxed text-slate-600">
                Nenhum critério aplicável ao FAMI neste diagnóstico. N/A não representa
                pontuação zero.
              </p>
            </div>
          </div>
        ) : (
          <p className={`${formSurface.messageWarning} text-sm`}>
            Sem resultado calculado para este diagnóstico.
          </p>
        )}
      </div>
    </PanelSection>
  );
}
