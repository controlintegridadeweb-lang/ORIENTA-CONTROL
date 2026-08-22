/**
 * Hierarquia tipográfica dos cards de recomendação.
 *
 * Níveis:
 * - label: identificador discreto do bloco (FORMULÁRIO, ÓRGÃO, …)
 * - body: conteúdo descritivo padrão
 * - highlight: único destaque principal (texto da recomendação)
 * - meta: apoio / acompanhamento (status textual, %, ações)
 */
export const recommendationCardType = {
  /** Nível 1 — rótulo do bloco (tamanho e peso em evidência). */
  label:
    "text-xs font-semibold uppercase tracking-wider text-slate-500",
  /** Nível 2 — conteúdo descritivo padrão. */
  body: "text-sm font-normal leading-relaxed text-slate-700",
  /**
   * Nível 3 — único destaque do card (texto da recomendação).
   * Mesmo tamanho do body; contraste só por cor e peso médio (não semibold em parágrafo longo).
   */
  highlight:
    "text-sm font-medium leading-relaxed text-slate-950",
  /** Nível 4 — metadados / acompanhamento. */
  meta: "text-sm font-normal leading-relaxed text-slate-600",
  metaSecondary: "text-xs font-normal text-slate-500",
} as const;

export type RecommendationCardTextVariant = keyof typeof recommendationCardType;
