import type { CSSProperties, ReactNode } from "react";
import { typography } from "@/shared/layout/design-system";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import {
  recommendationCardShell,
  recommendationHierarchySurface,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";

/** Fundo dos painéis da Visão geral (referência). */
export const OVERVIEW_SOFT_BG = "bg-slate-50/70";

/** Item de metadado — mesmo padrão tipográfico dos cards do portfólio. */
export function OverviewMetaItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <RecommendationCardField label={label}>
      <RecommendationCardText variant="body" as="div">
        {value}
      </RecommendationCardText>
    </RecommendationCardField>
  );
}

/** Grade de metadados (2 colunas na referência). */
export function OverviewMetaGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</div>
  );
}

/**
 * Título de bloco da Visão geral — tipografia da referência (sem trilho).
 */
export function OverviewBlockTitle({
  id,
  title,
  description,
}: {
  id?: string;
  title: string;
  description?: string;
  /** Mantido por compatibilidade; a referência não usa trilho no título. */
  accentColor?: string;
}) {
  return (
    <header className="space-y-1.5">
      <h2 id={id} className={typography.sectionTitle}>
        {title}
      </h2>
      {description ? (
        <RecommendationCardText variant="metaSecondary">
          {description}
        </RecommendationCardText>
      ) : null}
    </header>
  );
}

/** Painel azul-claro arredondado da Visão geral / Plano de integridade e compliance. */
export function OverviewSoftPanel({
  children,
  className = "",
  padded = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Quando false, o conteúdo controla o padding (ex.: tabela de ações). */
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={[
        OVERVIEW_SOFT_BG,
        "rounded-xl border border-slate-200",
        padded ? "px-4 py-4 sm:px-5 sm:py-5" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

/** Casca branca com trilho — usada em Plano de integridade e compliance / Monitoramento. */
export function OverviewCardShell({
  accentColor,
  children,
  className = "",
}: {
  accentColor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${recommendationCardShell.article} ${className}`.trim()}
    >
      {accentColor ? (
        <span
          aria-hidden
          className={recommendationCardShell.accentRail}
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
      <div className={`${recommendationCardShell.body} ${accentColor ? "pl-5 sm:pl-6" : ""}`.trim()}>
        {children}
      </div>
    </div>
  );
}

/**
 * Destaque de texto.
 * - `brand`: caixa verde sólida + texto branco (pergunta / recomendação).
 * - `soft`: fundo suave (legado / formulários).
 */
export function OverviewGuidancePanel({
  softBackground,
  tone = "soft",
  children,
}: {
  softBackground?: string;
  tone?: "soft" | "brand";
  children: ReactNode;
}) {
  if (tone === "brand") {
    return (
      <div className="rounded-xl bg-brand-400 px-4 py-3.5 text-white sm:px-5 sm:py-4">
        {children}
      </div>
    );
  }

  return (
    <div
      className={recommendationCardShell.guidancePanel}
      style={softBackground ? { backgroundColor: softBackground } : undefined}
    >
      {children}
    </div>
  );
}

export const overviewStack = "space-y-4";

/** Lista principal de ações — cabeçalho institucional da referência. */
export const overviewActionsTable = {
  table: "w-full min-w-[48rem] border-separate border-spacing-0 text-sm",
  headRow: "bg-brand-700",
  headCell:
    "px-3 py-3 text-center text-sm font-semibold text-white first:rounded-tl-xl last:rounded-tr-xl sm:px-4",
  bodyRow: "bg-white",
  bodyCell:
    "border-b border-slate-200/80 px-3 py-4 text-center align-middle text-sm text-slate-800 sm:px-4",
  openRow: "bg-[#E6F3F7]",
} as const;

/** Tabelas internas (visualizar / histórico) — cabeçalho leve da plataforma. */
export const overviewNestedTable = {
  table: "w-full border-separate border-spacing-0 text-sm",
  headRow: "bg-brand-700",
  headCell:
    "px-3 py-2.5 text-left text-micro font-medium uppercase tracking-wider text-white first:rounded-tl-xl last:rounded-tr-xl sm:px-4",
  bodyRow: "bg-white",
  bodyCell:
    "border-b border-slate-200/80 px-3 py-3.5 text-left align-middle text-sm text-slate-800 sm:px-4",
} as const;

export {
  RecommendationCardField,
  RecommendationCardText,
  recommendationCardShell,
  recommendationHierarchySurface,
};
