"use client";

import { useEffect, useState } from "react";
import type { RecommendationFilterOptions } from "@/features/improvement-management/recommendations/filter-options";
import { loadRecommendationFilters } from "@/features/improvement-management/recommendations/client";

/**
 * Carrega as opções canônicas de filtro de recomendações/planos.
 * Falha silenciosa: a tela principal trata o erro da consulta operacional.
 */
export function useRecommendationFilterOptions(): RecommendationFilterOptions | null {
  const [filterOptions, setFilterOptions] =
    useState<RecommendationFilterOptions | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRecommendationFilters()
      .then((options) => {
        if (!cancelled) setFilterOptions(options);
      })
      .catch(() => {
        if (!cancelled) setFilterOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return filterOptions;
}
