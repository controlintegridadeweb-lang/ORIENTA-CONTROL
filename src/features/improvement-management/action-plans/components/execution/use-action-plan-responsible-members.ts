"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listActionPlanResponsibleMembers,
  type ActionPlanResponsibleMember,
} from "@/features/improvement-management/action-plans/client";
import { describeError } from "@/infrastructure/notifications/notify";

/** Carrega respondentes elegíveis para área responsável do plano de ação. */
export function useActionPlanResponsibleMembers(enabled: boolean) {
  const [members, setMembers] = useState<ActionPlanResponsibleMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listActionPlanResponsibleMembers());
    } catch (caught: unknown) {
      setError(describeError(caught, "Não foi possível carregar os respondentes da organização."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicia a leitura assíncrona da API para o escopo atual.
    void reload();
  }, [enabled, reload]);

  return {
    members,
    loading,
    error,
    reload,
  };
}
