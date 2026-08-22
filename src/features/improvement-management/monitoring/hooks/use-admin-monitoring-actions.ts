"use client";

import { useCallback } from "react";
import { notify } from "@/infrastructure/notifications/notify";

type Options = {
  total: number;
  refetch: () => Promise<void>;
  exportData: () => Promise<void>;
  refreshSuccess: string;
  emptyExport: string;
  exportError: string;
};

export function useAdminMonitoringActions({
  total,
  refetch,
  exportData,
  refreshSuccess,
  emptyExport,
  exportError,
}: Options) {
  const refresh = useCallback(async () => {
    try {
      await refetch();
      notify.success(refreshSuccess);
    } catch {
      // O hook de leitura mantém a mensagem de erro da API.
    }
  }, [refetch, refreshSuccess]);

  const exportItems = useCallback(async () => {
    if (total === 0) {
      notify.warning(emptyExport);
      return;
    }
    try {
      await exportData();
      notify.success("Exportação concluída.");
    } catch (error: unknown) {
      notify.error(error instanceof Error ? error.message : exportError);
    }
  }, [emptyExport, exportData, exportError, total]);

  return { refresh, exportItems };
}
