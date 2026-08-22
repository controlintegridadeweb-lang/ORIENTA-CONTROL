"use client";

import { useMemo } from "react";
import { useRespondentOverviewItems } from "@/features/improvement-management/action-plans";
import {
  summarize,
  toRespondentItem,
  type RespondentRecommendationItem,
  type RespondentRecommendationSummary,
} from "@/features/improvement-management/recommendations/respondent-presentation";

type State = {
  rows: RespondentRecommendationItem[];
  summary: RespondentRecommendationSummary;
};

/**
 * Portfólio estratégico do respondente — overview em cache compartilhado.
 */
export function useRespondentRecommendations() {
  const { items, loading, error, refetch } = useRespondentOverviewItems();

  const state = useMemo<State>(() => {
    const rows = items.map(toRespondentItem);
    return { rows, summary: summarize(rows) };
  }, [items]);

  const formOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of state.rows) {
      if (r.formId && r.formName) map.set(r.formId, r.formName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [state.rows]);

  const axisOptions = useMemo(() => {
    const axes = new Map<string, string>();
    for (const row of state.rows) {
      if (row.axisId && row.axisName) axes.set(row.axisId, row.axisName);
    }
    return Array.from(axes.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [state.rows]);

  return {
    rows: state.rows,
    summary: state.summary,
    loading,
    error,
    formOptions,
    axisOptions,
    refetch,
  };
}
