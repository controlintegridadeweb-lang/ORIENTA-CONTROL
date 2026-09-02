"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { readPreliminaryApiError } from "@/features/fami/preliminary/panel-presentation";
import type { Bimester } from "@/shared/domain/calendar-periods";

const summarySchema = z.object({
  activeActionCount: z.number(),
  notStartedCount: z.number(),
  inProgressCount: z.number(),
  completedCount: z.number(),
  overdueCount: z.number(),
  cancelledCount: z.number(),
  averageProgressPercentage: z.number(),
  completedCriterionCount: z.number(),
  pendingCriterionCount: z.number(),
  actionsCompletedInPeriod: z.number(),
  actionsAdvancedInPeriod: z.number(),
  actionsStagnantInPeriod: z.number(),
  actionsBecameOverdueInPeriod: z.number(),
  criteriaCompletedInPeriod: z.number(),
});

const reportSchema = z.object({
  id: z.string().uuid(),
  bimester: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  reportVersion: z.number().int().positive(),
  generationKind: z.enum(["manual", "automatic"]),
  generatedAt: z.string(),
  closedAt: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  summary: summarySchema,
});

const payloadSchema = z.object({
  latestByPeriod: z.array(reportSchema),
  history: z.array(reportSchema),
});

export type BimonthlyReportView = z.infer<typeof reportSchema>;

const empty = { latestByPeriod: [] as BimonthlyReportView[], history: [] as BimonthlyReportView[] };

async function readBimonthlyReports(
  cycleId: string,
  referenceYear: number,
): Promise<{ latestByPeriod: BimonthlyReportView[]; history: BimonthlyReportView[] }> {
  const params = new URLSearchParams({ cycleId, year: String(referenceYear) });
  const response = await fetch(`/api/monitoring/bimonthly?${params.toString()}`, {
    cache: "no-store",
  });
  const raw: unknown = await response.json();
  if (!response.ok) {
    throw new Error(readPreliminaryApiError(raw, famiPreliminaryLabels.loadError));
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error(famiPreliminaryLabels.invalidResponse);
  return parsed.data;
}

export function useBimonthlyReports(
  cycleId: string | null | undefined,
  referenceYear: number,
) {
  const [payload, setPayload] = useState(empty);
  const [loading, setLoading] = useState(() => Boolean(cycleId));
  const [submitting, setSubmitting] = useState<Bimester | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scopeKey = `${cycleId ?? ""}:${referenceYear}`;
  const [observedScope, setObservedScope] = useState(scopeKey);

  if (observedScope !== scopeKey) {
    setObservedScope(scopeKey);
    setPayload(empty);
    setLoading(Boolean(cycleId));
    setError(null);
  }

  const reload = useCallback(async () => {
    if (!cycleId) {
      setPayload(empty);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPayload(await readBimonthlyReports(cycleId, referenceYear));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : famiPreliminaryLabels.loadError);
    } finally {
      setLoading(false);
    }
  }, [cycleId, referenceYear]);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    void readBimonthlyReports(cycleId, referenceYear)
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : famiPreliminaryLabels.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cycleId, referenceYear]);

  const generate = useCallback(
    async (bimester: Bimester) => {
      if (!cycleId) return;
      setSubmitting(bimester);
      setError(null);
      try {
        const response = await fetch("/api/monitoring/bimonthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleId, referenceYear, bimester }),
        });
        const raw: unknown = await response.json();
        if (!response.ok) {
          throw new Error(readPreliminaryApiError(raw, "Não foi possível gerar o relatório bimestral."));
        }
        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) throw new Error(famiPreliminaryLabels.invalidResponse);
        setPayload({ history: parsed.data.history, latestByPeriod: parsed.data.latestByPeriod });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Não foi possível gerar o relatório bimestral.",
        );
      } finally {
        setSubmitting(null);
      }
    },
    [cycleId, referenceYear],
  );

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(async (reportId: string, filename: string) => {
    setDownloadingId(reportId);
    setError(null);
    try {
      const response = await fetch(
        `/api/monitoring/bimonthly/${reportId}/export?format=pdf`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => null);
        throw new Error(readPreliminaryApiError(raw, "Não foi possível baixar o relatório bimestral."));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível baixar o relatório bimestral.",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return { payload, loading, submitting, downloadingId, error, reload, generate, download };
}
