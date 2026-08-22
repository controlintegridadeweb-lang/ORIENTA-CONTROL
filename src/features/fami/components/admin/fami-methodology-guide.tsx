"use client";

import { useState } from "react";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import {
  FAMI_EXPLAIN_CARDS,
  FAMI_GUIDE_INTRO,
  FAMI_SCORING_GROUPS,
} from "@/features/fami/methodology-content";
import { FamiResultAvailabilityNotice } from "@/features/fami/components/fami-result-availability-notice";
import { FamiMaturityRoadmap } from "./fami-maturity-roadmap";

type Props = {
  defaultExpanded?: boolean;
  currentLevel?: number | null;
  className?: string;
  /** Quando true, o aviso de disponibilidade do resultado fica como intro do guia. */
  showAvailabilityNotice?: boolean;
  /** Encaminhado ao `SectionHeader` (espaçamento do cabeçalho). */
  size?: "default" | "compact";
};

type ExplainStep = (typeof FAMI_EXPLAIN_CARDS)[number];

/** Escala da timeline (proporções da referência: anel + ponto ~1/3 + haste). */
const NODE = 36; // px — diâmetro do nó
const LINE = 3; // px — espessura da linha (= traço do anel)
const DOT = 12; // px — ponto central (~1/3 do nó)

function ScoringRules() {
  return (
    <div className="mt-3 space-y-3">
      <p className={typography.cardTitle}>
        Regras por tipo de resposta
      </p>
      {FAMI_SCORING_GROUPS.map((group) => (
        <section key={group.id} className="space-y-1">
          <p className={typography.cardTitle}>{group.title}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm leading-relaxed text-slate-700 marker:text-slate-500">
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Nó: anel + ponto central (referência). */
function TimelineNode() {
  return (
    <span
      className="relative z-2 box-border flex shrink-0 items-center justify-center rounded-full border-brand-400 bg-white"
      style={{ width: NODE, height: NODE, borderWidth: LINE }}
      aria-hidden
    >
      <span
        className="rounded-full bg-brand-400"
        style={{ width: DOT, height: DOT }}
      />
    </span>
  );
}

function TimelineStep({
  step,
  index,
  isLast,
}: {
  step: ExplainStep;
  index: number;
  isLast: boolean;
}) {
  const nodeCenter = NODE / 2;

  return (
    <li
      className="fami-guide-step-in relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Trilho: segmentos só entre os centros dos nós */}
      <div className="relative flex justify-center self-stretch">
        {index > 0 ? (
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 bg-brand-400"
            style={{ width: LINE, height: nodeCenter }}
            aria-hidden
          />
        ) : null}
        {!isLast ? (
          <span
            className="absolute left-1/2 bottom-0 -translate-x-1/2 bg-brand-400"
            style={{ width: LINE, top: nodeCenter }}
            aria-hidden
          />
        ) : null}
        <TimelineNode />
      </div>

      <div className={`min-w-0 ${isLast ? "" : "pb-8"}`}>
        {/* Título alinhado verticalmente ao centro do nó */}
        <div className="flex items-center" style={{ minHeight: NODE }}>
          <h3 className={typography.subsectionTitle}>
            {step.title}
          </h3>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
          {step.description}
        </p>
        {step.id === "how" ? <ScoringRules /> : null}
      </div>
    </li>
  );
}

/** Timeline vertical — linha e nós na escala da referência. */
function FamiExplainTimeline() {
  return (
    <div className="relative max-w-3xl">
      <ol className="relative">
        {FAMI_EXPLAIN_CARDS.map((step, index) => (
          <TimelineStep
            key={step.id}
            step={step}
            index={index}
            isLast={index === FAMI_EXPLAIN_CARDS.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

export function FamiMethodologyGuide({
  defaultExpanded = false,
  currentLevel = null,
  className = "",
  showAvailabilityNotice = false,
  size = "default",
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const showBody = showAvailabilityNotice || expanded;

  return (
    <PanelSection
      title="Como o FAMI funciona"
      description={FAMI_GUIDE_INTRO}
      variant="plain"
      size={size}
      className={className}
      actions={
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={formSurface.secondaryButtonSm}
          aria-expanded={expanded}
        >
          {expanded ? "Ocultar guia" : "Expandir guia"}
        </button>
      }
    >
      {showBody ? (
        <div className="space-y-4">
          {showAvailabilityNotice ? <FamiResultAvailabilityNotice /> : null}

          {expanded ? (
            <div className="space-y-12 bg-white pt-1 sm:space-y-14">
              <FamiExplainTimeline />
              <FamiMaturityRoadmap currentLevel={currentLevel} />
            </div>
          ) : null}
        </div>
      ) : null}
    </PanelSection>
  );
}
