"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useRef } from "react";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { RespondentSectionGroup } from "@/features/workbench/components/respondent-form/respondent-question-panel";
import { countUnresolvedAdjustments } from "@/features/workbench/adjustment-progress";
import { sectionCompletion } from "@/features/workbench/section-completion";

type Props = {
  sections: RespondentSectionGroup[];
  currentSectionIndex: number;
  evidenceDrafts: Record<string, EvidenceDraft>;
  pendingYesQuestionIds?: ReadonlySet<string>;
  pendingNaQuestionIds?: ReadonlySet<string>;
  naJustificationDrafts?: Record<string, string>;
  adjustmentMode?: boolean;
  disabled?: boolean;
  onSelect: (sectionIndex: number) => void;
};

function adjustmentLabel(count: number): string {
  if (count === 0) return "Sem correções pendentes";
  return count === 1 ? "1 correção pendente" : `${count} correções pendentes`;
}

/** Navegação direta entre as seções do diagnóstico, com estado por seção. */
export function RespondentSectionNavigation({
  sections,
  currentSectionIndex,
  evidenceDrafts,
  pendingYesQuestionIds,
  pendingNaQuestionIds,
  naJustificationDrafts,
  adjustmentMode = false,
  disabled,
  onSelect,
}: Props) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentSectionIndex]);

  if (sections.length <= 1) return null;

  const sectionsWithProgress = sections.map((section, index) => {
    const pendingAdjustments = adjustmentMode
      ? countUnresolvedAdjustments(section.rows)
      : 0;
    const progress = adjustmentMode
      ? null
      : sectionCompletion(section.rows, {
          evidenceDrafts,
          pendingYesQuestionIds,
          pendingNaQuestionIds,
          naJustificationDrafts,
        });
    const complete = adjustmentMode
      ? pendingAdjustments === 0
      : Boolean(progress && progress.total > 0 && progress.completed === progress.total);

    return {
      section,
      index,
      progress,
      pendingAdjustments,
      active: index === currentSectionIndex,
      complete,
    };
  });

  return (
    <nav
      aria-label="Seções do formulário"
      className="sticky top-[var(--header-h)] z-10 border-b border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:px-8 sm:py-3 lg:px-10"
    >
      <div className="sm:hidden">
        <label htmlFor="respondent-section-select" className="sr-only">
          Seção atual do formulário
        </label>
        <select
          id="respondent-section-select"
          value={currentSectionIndex}
          disabled={disabled}
          onChange={(event) => onSelect(Number(event.target.value))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sectionsWithProgress.map(
            ({ section, index, progress, pendingAdjustments, complete }) => (
              <option key={`${index}-${section.name}`} value={index}>
                {index + 1}. {section.name} — {adjustmentMode
                  ? adjustmentLabel(pendingAdjustments).toLowerCase()
                  : `${progress?.completed ?? 0}/${progress?.total ?? 0}${
                      complete ? " concluída" : ""
                    }`}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="hidden sm:block">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Seções do formulário
          </p>
          <p className="text-xs text-slate-500">
            {adjustmentMode
              ? "As correções pendentes estão indicadas em cada seção."
              : "Navegue livremente; as pendências serão validadas no envio."}
          </p>
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {sectionsWithProgress.map(
            ({
              section,
              index,
              progress,
              pendingAdjustments,
              active,
              complete,
            }) => (
              <button
                key={`${index}-${section.name}`}
                ref={active ? activeButtonRef : undefined}
                type="button"
                aria-current={active ? "step" : undefined}
                disabled={disabled}
                onClick={() => onSelect(index)}
                className={`min-w-48 snap-center rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "border-brand-300 bg-brand-50 text-brand-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      complete
                        ? "bg-emerald-100 text-emerald-800"
                        : adjustmentMode && pendingAdjustments > 0
                          ? "bg-amber-100 text-amber-800"
                          : active
                            ? "bg-brand-100 text-brand-800"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {complete ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : adjustmentMode && pendingAdjustments > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">
                      {section.name}
                    </span>
                    <span
                      className={`mt-1 block text-xs tabular-nums ${
                        adjustmentMode && pendingAdjustments > 0
                          ? "font-medium text-amber-700"
                          : "text-slate-500"
                      }`}
                    >
                      {adjustmentMode
                        ? adjustmentLabel(pendingAdjustments)
                        : `${progress?.completed ?? 0} de ${progress?.total ?? 0} concluída${
                            progress?.total === 1 ? "" : "s"
                          }`}
                    </span>
                  </span>
                </span>
              </button>
            ),
          )}
        </div>
      </div>
    </nav>
  );
}
