"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RespondentProgress } from "./contracts";
import { fetchRespondentFormsProgress } from "./client";
import {
  computeRespondentDashboardSummary,
  type RespondentDashboardSummary,
} from "./respondent-dashboard-summary";

type Options = {
  initialForms: RespondentProgress[];
  initialYear: number;
  initialSummary?: RespondentDashboardSummary;
  /** Dispara nova leitura após envio/reenvio (`submission` + `cycleId` na URL). */
  reloadToken?: string | null;
};

function respondentProgressSnapshotKey(forms: RespondentProgress[]): string {
  return forms.map((form) => `${form.cycleId}:${form.state}:${form.submissionReady}`).join("|");
}

/**
 * Carrega progresso do respondente ao montar, quando o ano muda ou após envio.
 * O SSR entrega um primeiro paint; a API client-side garante dados atualizados.
 */
export function useRespondentYearProgress({
  initialForms,
  initialYear,
  initialSummary,
  reloadToken = null,
}: Options) {
  const [year, setYear] = useState(initialYear);
  const [forms, setForms] = useState(initialForms);
  const [summary, setSummary] = useState(
    initialSummary ?? computeRespondentDashboardSummary(initialForms),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const hasLoadedOnce = useRef(false);
  const serverSnapshotKey = useMemo(
    () => respondentProgressSnapshotKey(initialForms),
    [initialForms],
  );
  const serverEpoch = `${initialYear}::${serverSnapshotKey}`;
  const [prevServerEpoch, setPrevServerEpoch] = useState(serverEpoch);

  // Quando o SSR/rota entrega um novo snapshot, alinha o estado local no render
  // (padrão oficial do React — evita setState em Effect).
  if (serverEpoch !== prevServerEpoch) {
    setPrevServerEpoch(serverEpoch);
    setYear(initialYear);
    setForms(initialForms);
    setSummary(initialSummary ?? computeRespondentDashboardSummary(initialForms));
  }

  const load = useCallback(async (periodYear: number, options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    const seq = ++requestSeq.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetchRespondentFormsProgress(periodYear);
      if (seq !== requestSeq.current) return;
      setForms(res.items);
      setSummary(computeRespondentDashboardSummary(res.items));
    } catch (e: unknown) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : "Falha ao carregar dados.");
      setForms([]);
      setSummary(computeRespondentDashboardSummary([]));
    } finally {
      if (seq === requestSeq.current && showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year, { showLoading: hasLoadedOnce.current });
    hasLoadedOnce.current = true;
  }, [year, load, reloadToken]);

  return { year, setYear, forms, summary, loading, error };
}
