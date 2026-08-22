export type RecommendationExceptionStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "expired";

export type RecommendationException = {
  id: string;
  organizationId: string;
  recommendationId: string;
  questionId: string | null;
  motivo: string;
  prazo: string | null;
  status: RecommendationExceptionStatus;
  requestedBy: string | null;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
