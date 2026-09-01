import type { RecommendationStatus } from "@/shared/domain/recommendation-status";

/**
 * Situação operacional da recomendação. A recomendação é gerada pelo
 * processamento do diagnóstico e não pode ser editada diretamente; seu
 * acompanhamento acontece no plano de integridade e compliance associado.
 */
export type { RecommendationStatus };
