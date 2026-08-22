"use client";

import { useCallback, useEffect, useState } from "react";
import { getAnswersFilterOptions } from "@/features/forms/answers-client";
import type {
  AnswersListFilters,
  RespondentFilterOptions,
} from "@/features/forms/answers-types";

const EMPTY_FILTERS: AnswersListFilters = {
  organizationId: null,
  status: null,
  from: null,
  to: null,
};

function filtersEqual(a: AnswersListFilters, b: AnswersListFilters): boolean {
  return (
    (a.organizationId ?? null) === (b.organizationId ?? null) &&
    (a.status ?? null) === (b.status ?? null) &&
    (a.from ?? null) === (b.from ?? null) &&
    (a.to ?? null) === (b.to ?? null)
  );
}

/**
 * Gerencia os filtros da listagem de respondentes e as opções de filtro
 * carregadas da API.
 */
export function useAnswersFilters({ formId }: { formId: string }) {
  const [filters, setFilters] = useState<AnswersListFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<RespondentFilterOptions | null>(null);

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await getAnswersFilterOptions(formId);
      setFilterOptions(opts);
    } catch {
      // filtros são best-effort; falha não bloqueia a tela
    }
  }, [formId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual; os setters ocorrem na continuação da requisição.
    void loadFilterOptions();
  }, [loadFilterOptions]);

  return {
    filters,
    setFilters,
    filterOptions,
    filtersEqual,
    EMPTY_FILTERS,
  };
}
