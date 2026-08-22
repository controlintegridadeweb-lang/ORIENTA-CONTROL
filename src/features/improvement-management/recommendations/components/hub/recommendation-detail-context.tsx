"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import {
  getAdminActionPlanByRecommendation,
  getRespondentActionPlanByRecommendation,
} from "@/features/improvement-management/action-plans/client";
import { toAdminItem, type AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import {
  toRespondentItem,
  type RespondentRecommendationItem,
} from "@/features/improvement-management/recommendations/respondent-presentation";
import { invalidateRespondentOverviewCache } from "@/features/improvement-management/action-plans";
import { describeError } from "@/infrastructure/notifications/notify";

export type RecommendationDetailRole = "respondent" | "admin";

export type RecommendationWorkspaceSurface = "default" | "operational" | "supervision" | "document";

type ContextValue = {
  role: RecommendationDetailRole;
  recommendationId: string;
  listPath: string;
  detailBasePath: string;
  /** Segmento da URL da aba de execução (`plano` em rotas admin; `acoes` no workspace do respondente). */
  actionsTabHrefSegment: string;
  actionsTabLabel: string;
  workspaceSurface: RecommendationWorkspaceSurface;
  row: ActionPlanListItem | null;
  respondentItem: RespondentRecommendationItem | null;
  adminItem: AdminRecommendationItem | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const RecommendationDetailContext = createContext<ContextValue | null>(null);

export function RecommendationDetailProvider({
  recommendationId,
  role,
  listPath,
  detailBasePath: detailBasePathOverride,
  actionsTabHrefSegment = "plano",
  actionsTabLabel = "Plano de ação",
  workspaceSurface = "default",
  children,
}: {
  recommendationId: string;
  role: RecommendationDetailRole;
  listPath: string;
  /** Quando omitido: `{listPath}/{recommendationId}` (hub junto à lista). */
  detailBasePath?: string;
  actionsTabHrefSegment?: string;
  actionsTabLabel?: string;
  workspaceSurface?: RecommendationWorkspaceSurface;
  children: ReactNode;
}) {
  const detailBasePath = detailBasePathOverride ?? `${listPath}/${recommendationId}`;

  const [row, setRow] = useState<ActionPlanListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const item =
        role === "respondent"
          ? await getRespondentActionPlanByRecommendation(recommendationId)
          : await getAdminActionPlanByRecommendation(recommendationId);
      setRow(item);
      if (role === "respondent") invalidateRespondentOverviewCache();
      if (!item) setError("Recomendação não encontrada ou sem permissão para visualizar.");
    } catch (e) {
      setRow(null);
      setError(describeError(e, "Falha ao carregar a recomendação."));
    } finally {
      setLoading(false);
    }
  }, [recommendationId, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void load();
  }, [load]);

  const respondentItem = useMemo(
    () => (row ? toRespondentItem(row) : null),
    [row],
  );
  const adminItem = useMemo(() => (row ? toAdminItem(row) : null), [row]);

  const value = useMemo<ContextValue>(
    () => ({
      role,
      recommendationId,
      listPath,
      detailBasePath,
      actionsTabHrefSegment,
      actionsTabLabel,
      workspaceSurface,
      row,
      respondentItem,
      adminItem,
      loading,
      error,
      refetch: load,
    }),
    [
      role,
      recommendationId,
      listPath,
      detailBasePath,
      actionsTabHrefSegment,
      actionsTabLabel,
      workspaceSurface,
      row,
      respondentItem,
      adminItem,
      loading,
      error,
      load,
    ],
  );

  return (
    <RecommendationDetailContext.Provider value={value}>
      {children}
    </RecommendationDetailContext.Provider>
  );
}

export function useRecommendationDetailContext(): ContextValue {
  const ctx = useContext(RecommendationDetailContext);
  if (!ctx) {
    throw new Error("useRecommendationDetailContext must be used within RecommendationDetailProvider");
  }
  return ctx;
}
