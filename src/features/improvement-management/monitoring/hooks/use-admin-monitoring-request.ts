"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeError, notify } from "@/infrastructure/notifications/notify";

export type AdminMonitoringRequestState<TResult> = {
  data: TResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useAdminMonitoringRequest<TResult>(
  request: (signal: AbortSignal) => Promise<TResult>,
  errorFallback: string,
): AdminMonitoringRequestState<TResult> {
  const [data, setData] = useState<TResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  const execute = useCallback(async () => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    setLoading(true);
    setError(null);

    try {
      const result = await request(controller.signal);
      if (!controller.signal.aborted && requestSequence.current === sequence) {
        setData(result);
      }
    } catch (caught: unknown) {
      if (controller.signal.aborted) return;
      const message = describeError(caught, errorFallback);
      if (requestSequence.current === sequence) setError(message);
      notify.error(message);
      throw caught;
    } finally {
      if (!controller.signal.aborted && requestSequence.current === sequence) {
        setLoading(false);
      }
    }
  }, [request, errorFallback]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A execução inicia a leitura remota; os setters seguintes refletem o ciclo da requisição.
    void execute().catch(() => undefined);
    return () => activeController.current?.abort();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
