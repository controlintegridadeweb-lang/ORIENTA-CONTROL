import type { RecommendationStatus } from "./schemas";

/** Opções de filtro administrativas (API e UI). Sem dependências de servidor. */
export type RecommendationFilterOptions = {
  forms: { id: string; name: string; version: number }[];
  organizations: { id: string; name: string }[];
  axes: { id: string; name: string }[];
  types: string[];
  statuses: RecommendationStatus[];
};
