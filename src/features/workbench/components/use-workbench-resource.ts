"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { parseJson } from "@/infrastructure/api/fetch-client";
import { fetchWorkbenchData } from "@/infrastructure/client/workbench-api";
import { describeError } from "@/infrastructure/notifications/notify";
import type { WorkbenchPayload } from "./workbench-helpers";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkbenchPayload(value: unknown): value is WorkbenchPayload {
  if (!isRecord(value) || !isRecord(value.form) || !isRecord(value.cycle)) return false;
  return (
    typeof value.form.id === "string" &&
    typeof value.form.name === "string" &&
    typeof value.form.version === "number" &&
    typeof value.form.state === "string" &&
    typeof value.cycle.id === "string" &&
    typeof value.cycle.state === "string" &&
    Array.isArray(value.rows)
  );
}

function payloadErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.error === "string") return value.error;
  if (isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }
  return null;
}

const workbenchResponseSchema = z.union([
  z.custom<WorkbenchPayload>(isWorkbenchPayload, {
    error: "Contrato inválido do workbench.",
  }),
  z.object({
    error: z.union([z.string(), z.object({ message: z.string() }).passthrough()]),
  }).passthrough(),
]);

export function useWorkbenchResource({
  ids,
  canAutoLoad,
  simplifiedRespondent,
}: {
  ids: WorkbenchIds;
  canAutoLoad: boolean;
  simplifiedRespondent: boolean;
}) {
  const [data, setData] = useState<WorkbenchPayload | null>(null);
  const [feedback, setFeedback] = useState<WorkbenchFeedback | null>(null);
  const [loading, setLoading] = useState(() => canAutoLoad);
  const hasLoadedWorkbenchRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);

  const loadWorkbenchData = useCallback(async (): Promise<WorkbenchPayload | null> => {
    const requestSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestSequence;
    loadAbortControllerRef.current?.abort();

    const controller = new AbortController();
    loadAbortControllerRef.current = controller;
    const isRefresh = hasLoadedWorkbenchRef.current;

    setLoading(true);
    if (simplifiedRespondent || !isRefresh) setFeedback(null);

    try {
      const response = await fetchWorkbenchData(ids, { signal: controller.signal });
      const payload = await parseJson(response, workbenchResponseSchema);
      if (requestSequence !== loadSequenceRef.current) return null;

      if (!response.ok) {
        setFeedback({
          tone: "error",
          title: "Não foi possível carregar o diagnóstico",
          description: payloadErrorMessage(payload) ?? "Falha ao carregar dados.",
          retryAction: "reload",
        });
        return null;
      }
      if (!isWorkbenchPayload(payload)) {
        setFeedback({
          tone: "error",
          title: "Não foi possível carregar o diagnóstico",
          description: "O servidor retornou um contrato de diagnóstico inválido.",
          retryAction: "reload",
        });
        return null;
      }

      setData(payload);
      hasLoadedWorkbenchRef.current = true;
      setFeedback(null);
      return payload;
    } catch (error: unknown) {
      if (controller.signal.aborted || requestSequence !== loadSequenceRef.current) return null;
      setFeedback({
        tone: "error",
        title: "Não foi possível carregar o diagnóstico",
        description: describeError(
          error,
          "Falha de conexão ao carregar o diagnóstico. Tente novamente.",
        ),
        retryAction: "reload",
      });
      return null;
    } finally {
      if (requestSequence === loadSequenceRef.current) {
        setLoading(false);
        if (loadAbortControllerRef.current === controller) {
          loadAbortControllerRef.current = null;
        }
      }
    }
  }, [ids, simplifiedRespondent]);

  const loadWorkbench = useCallback(
    async (): Promise<boolean> => (await loadWorkbenchData()) !== null,
    [loadWorkbenchData],
  );

  useEffect(() => {
    loadSequenceRef.current += 1;
    loadAbortControllerRef.current?.abort();
    loadAbortControllerRef.current = null;
    hasLoadedWorkbenchRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- troca de ciclo invalida o snapshot anterior.
    setData(null);
    setLoading(canAutoLoad);
    setFeedback(null);
  }, [canAutoLoad, ids.cycleId]);

  useEffect(
    () => () => {
      loadSequenceRef.current += 1;
      loadAbortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia a leitura assíncrona do escopo atual.
    if (canAutoLoad) void loadWorkbench();
  }, [canAutoLoad, loadWorkbench]);

  return {
    data,
    setData,
    feedback,
    setFeedback,
    loading,
    loadWorkbench,
    loadWorkbenchData,
  };
}
