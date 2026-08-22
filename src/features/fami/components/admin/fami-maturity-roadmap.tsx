"use client";

import Image from "next/image";
import { typography } from "@/shared/layout/design-system";
import {
  FAMI_LEVEL_THRESHOLDS,
  FAMI_MATURITY_JOURNEY_SUMMARY,
  famiLevelIllustrationPath,
} from "@/features/fami/methodology-content";
import {
  MATURITY_LEVEL_CARD_LAYOUT as LAYOUT,
  MATURITY_LEVEL_SELECTED,
  maturityLevelVariant,
} from "@/features/fami/maturity-level-variants";
import { LEVEL_META, type FamiLevel } from "@/features/fami/respondent-presentation";

type Props = {
  currentLevel?: number | null;
  className?: string;
};

function normalizeLevel(level: number | null | undefined): FamiLevel | null {
  if (level == null || level < 1 || level > 5) return null;
  return level as FamiLevel;
}

type MaturityLevelCardProps = {
  level: FamiLevel;
  isCurrent?: boolean;
  isPast?: boolean;
};

/**
 * Card de nível — estrutura da referência:
 * badge no topo → cabeçalho colorido (nome + faixa) → ilustração → rodapé itálico.
 */
export function MaturityLevelCard({
  level,
  isCurrent = false,
  isPast = false,
}: MaturityLevelCardProps) {
  const meta = LEVEL_META[level];
  const tone = maturityLevelVariant(level);
  const summary = FAMI_MATURITY_JOURNEY_SUMMARY[level];

  return (
    <div className={LAYOUT.wrap}>
      <article
        className={[
          LAYOUT.article,
          tone.border,
          isCurrent ? MATURITY_LEVEL_SELECTED : tone.hover,
          isPast && !isCurrent ? "opacity-95" : "",
        ].join(" ")}
        aria-current={isCurrent ? "step" : undefined}
      >
        <span className={`${LAYOUT.badge} ${tone.header}`} aria-hidden>
          {level}
        </span>

        <header className={`${LAYOUT.header} ${tone.header} ${tone.headerText}`}>
          {isCurrent ? <span className={LAYOUT.currentTag}>Seu nível</span> : null}
          <h3 className={LAYOUT.title}>{meta.shortLabel}</h3>
          <p className={LAYOUT.range}>{meta.range}</p>
        </header>

        <div className={LAYOUT.body}>
          <div className={LAYOUT.imageArea}>
            <Image
              src={famiLevelIllustrationPath(level)}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
              className={LAYOUT.image}
              priority={level <= 2}
            />
          </div>

          <div className={LAYOUT.description}>
            <p className={LAYOUT.descriptionText}>{summary}</p>
          </div>
        </div>
      </article>
    </div>
  );
}

/** Jornada de maturidade — grade 5 colunas no desktop, como na referência. */
export function FamiMaturityRoadmap({ currentLevel, className = "" }: Props) {
  const active = normalizeLevel(currentLevel);

  return (
    <div className={`relative isolate space-y-5 ${className}`.trim()}>
      <div className="min-w-0">
        <h3 className={typography.sectionTitle}>
          Jornada de maturidade
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-700">
          Cinco etapas de evolução — da estrutura inicial à governança madura.
        </p>
      </div>

      <ol
        className="grid auto-rows-fr grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4"
        aria-label="Progressão dos níveis de maturidade FAMI"
      >
        {FAMI_LEVEL_THRESHOLDS.map(({ level }) => {
          const step = level as FamiLevel;
          const isCurrent = active === step;
          const isPast = active != null && step < active;

          return (
            <li key={level} className="flex h-full min-w-0">
              <MaturityLevelCard level={step} isCurrent={isCurrent} isPast={isPast} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
