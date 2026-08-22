"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/browser";

type UseTableSyncInput = {
  table: "responses" | "action_plans" | "action_plan_documents";
  filter: string;
  enabled?: boolean;
  onChange: () => void | Promise<void>;
};

function channelSuffix(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Sincroniza leituras abertas em múltiplas abas/usuários via Supabase Realtime.
 * O callback fica em ref para não recriar o canal a cada renderização.
 */
export function useTableSync({ table, filter, enabled = true, onChange }: UseTableSyncInput) {
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !filter) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`sync:${table}:${filter}:${channelSuffix()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter },
        () => void callbackRef.current(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, filter, table]);
}
