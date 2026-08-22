"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import type { Quadrimester } from "@/features/fami/preliminary/domain";
import {
  readPreliminaryApiError,
  selectLatestCheckpoint,
} from "@/features/fami/preliminary/panel-presentation";

export type PreliminaryScore = {
  pointsObtained: number;
  pointsPossible: number;
  percentage: number;
  maturityLevel: number | null;
};

export type PreliminaryCheckpoint = {
  id: string;
  referenceYear: number;
  quadrimester: Quadrimester;
  calculationVersion: number;
  methodologyVersion: string;
  calculationKind: "manual" | "automatic";
  calculatedBy: string | null;
  periodEnd: string;
  calculatedAt: string;
  closedAt: string | null;
  sourceProcessingVersion: number;
  sourcePolicyVersion: string;
  official: PreliminaryScore | null;
  preliminary: PreliminaryScore | null;
  deltaPercentagePoints: number | null;
};

export type PreliminaryTrackingContext = {
  officialAvailableAt: string | null;
  earliestActionCreatedAt: string | null;
};

export type PreliminaryPayload = {
  latestByPeriod: PreliminaryCheckpoint[];
  history: PreliminaryCheckpoint[];
  tracking: PreliminaryTrackingContext;
};

const scoreSchema = z.object({
  pointsObtained: z.number(),
  pointsPossible: z.number(),
  percentage: z.number(),
  maturityLevel: z.number().nullable(),
});

const checkpointSchema = z.object({
  id: z.string().uuid(),
  referenceYear: z.number().int(),
  quadrimester: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  calculationVersion: z.number().int().positive(),
  methodologyVersion: z.string(),
  calculationKind: z.enum(["manual", "automatic"]),
  calculatedBy: z.string().uuid().nullable(),
  periodEnd: z.string(),
  calculatedAt: z.string(),
  closedAt: z.string().nullable(),
  sourceProcessingVersion: z.number().int().positive(),
  sourcePolicyVersion: z.string(),
  official: scoreSchema.nullable(),
  preliminary: scoreSchema.nullable(),
  deltaPercentagePoints: z.number().nullable(),
});

const trackingSchema = z.object({
  officialAvailableAt: z.string().nullable(),
  earliestActionCreatedAt: z.string().nullable(),
});

const apiPayloadSchema = z.object({
  latestByPeriod: z.array(checkpointSchema),
  history: z.array(checkpointSchema),
  tracking: trackingSchema,
});

const emptyPayload: PreliminaryPayload = {
  history: [],
  latestByPeriod: [],
  tracking: { officialAvailableAt: null, earliestActionCreatedAt: null },
};

export function useFamiPreliminary(
  cycleId: string | null | undefined,
  referenceYear: number,
) {
  const [payload, setPayload] = useState<PreliminaryPayload>(emptyPayload);
  const [loading, setLoading] = useState(() => Boolean(cycleId));
  const [submitting, setSubmitting] = useState<Quadrimester | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const scopeKey = `${cycleId ?? ""}:${referenceYear}`;
  const [observedScope, setObservedScope] = useState(scopeKey);

  if (observedScope !== scopeKey) {
    setObservedScope(scopeKey);
    setPayload(emptyPayload);
    setLoading(Boolean(cycleId));
    setError(null);
    setMessage(null);
  }

  const readPreliminary = useCallback(async (): Promise<PreliminaryPayload> => {
    if (!cycleId) return emptyPayload;
    const params = new URLSearchParams({ cycleId, year: String(referenceYear) });
    const response = await fetch(`/api/fami/preliminary?${params.toString()}`, {
      cache: "no-store",
    });
    const raw: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readPreliminaryApiError(raw, famiPreliminaryLabels.loadError));
    }
    const parsed = apiPayloadSchema.safeParse(raw);
    if (!parsed.success) throw new Error(famiPreliminaryLabels.invalidResponse);
    return {
      history: parsed.data.history,
      latestByPeriod: parsed.data.latestByPeriod,
      tracking: parsed.data.tracking,
    };
  }, [cycleId, referenceYear]);

  const reload = useCallback(async () => {
    if (!cycleId) {
      setPayload(emptyPayload);
      setError(null);
      setMessage(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPayload(await readPreliminary());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : famiPreliminaryLabels.loadError);
    } finally {
      setLoading(false);
    }
  }, [cycleId, readPreliminary]);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    void readPreliminary()
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : famiPreliminaryLabels.loadError,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cycleId, readPreliminary]);

  const calculate = useCallback(
    async (quadrimester: Quadrimester) => {
      if (!cycleId) return;
      setSubmitting(quadrimester);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/fami/preliminary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleId, referenceYear, quadrimester }),
        });
        const raw: unknown = await response.json();
        if (!response.ok) {
          throw new Error(readPreliminaryApiError(raw, famiPreliminaryLabels.calculateError));
        }
        const parsed = apiPayloadSchema.safeParse(raw);
        if (!parsed.success) throw new Error(famiPreliminaryLabels.invalidResponse);
        const hadCheckpoint = payload.latestByPeriod.some((row) => row.quadrimester === quadrimester);
        setPayload({
          history: parsed.data.history,
          latestByPeriod: parsed.data.latestByPeriod,
          tracking: parsed.data.tracking,
        });
        setMessage(
          hadCheckpoint
            ? famiPreliminaryLabels.recalculated(quadrimester)
            : famiPreliminaryLabels.calculated(quadrimester),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : famiPreliminaryLabels.calculateError);
      } finally {
        setSubmitting(null);
      }
    },
    [cycleId, payload.latestByPeriod, referenceYear],
  );

  const latest = useMemo(
    () => selectLatestCheckpoint(payload.latestByPeriod),
    [payload.latestByPeriod],
  );

  return {
    payload,
    latest,
    loading,
    submitting,
    error,
    message,
    reload,
    calculate,
  };
}

export type FamiPreliminaryController = ReturnType<typeof useFamiPreliminary>;
