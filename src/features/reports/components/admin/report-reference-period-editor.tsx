"use client";

import { useState } from "react";
import { formSurface } from "@/shared/layout/form-surface";
import { notify } from "@/infrastructure/notifications/notify";
import { updateAdminCycleReferencePeriod } from "@/features/cycles";
import type { ReportCycleOption } from "@/features/reports/ui/client";

function periodLabel(startYear: number, endYear: number): string {
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`;
}

export function ReportReferencePeriodEditor({
  cycle,
  disabled,
  onSaved,
}: {
  cycle: ReportCycleOption;
  disabled: boolean;
  onSaved(reference: { referenceStartYear: number; referenceEndYear: number }): Promise<void>;
}) {
  const [startYear, setStartYear] = useState(cycle.referenceStartYear?.toString() ?? "");
  const [endYear, setEndYear] = useState(cycle.referenceEndYear?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  if (cycle.referenceStartYear != null && cycle.referenceEndYear != null) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
        Referência institucional do relatório: <strong>{periodLabel(cycle.referenceStartYear, cycle.referenceEndYear)}</strong>.
      </p>
    );
  }

  async function handleSave() {
    const parsedStart = Number(startYear);
    const parsedEnd = Number(endYear);
    if (!Number.isInteger(parsedStart) || parsedStart < 1900 || parsedStart > 2199) {
      notify.warning("Informe um ano inicial válido.");
      return;
    }
    if (!Number.isInteger(parsedEnd) || parsedEnd < parsedStart || parsedEnd > 2199) {
      notify.warning("Informe um ano final igual ou posterior ao ano inicial.");
      return;
    }

    setSaving(true);
    const notificationId = notify.loading("Salvando referência institucional…");
    try {
      const saved = await updateAdminCycleReferencePeriod(cycle.cycleId, {
        referenceStartYear: parsedStart,
        referenceEndYear: parsedEnd,
      });
      await onSaved(saved);
      notify.success("Referência institucional salva.", { id: notificationId });
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "Não foi possível salvar a referência.",
        { id: notificationId },
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">Defina a referência institucional</p>
      <p className="mt-1 text-xs text-amber-800">
        Este diagnóstico foi criado antes do período estruturado. A emissão fica bloqueada até que os anos de referência sejam informados. Essa referência será congelada a partir da próxima emissão oficial.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className={formSurface.fieldGroup}>
          <label htmlFor="report-reference-start-year" className={formSurface.label}>Ano inicial</label>
          <input
            id="report-reference-start-year"
            type="number"
            min={1900}
            max={2199}
            className={formSurface.input}
            value={startYear}
            onChange={(event) => setStartYear(event.target.value)}
            disabled={disabled || saving}
          />
        </div>
        <div className={formSurface.fieldGroup}>
          <label htmlFor="report-reference-end-year" className={formSurface.label}>Ano final</label>
          <input
            id="report-reference-end-year"
            type="number"
            min={1900}
            max={2199}
            className={formSurface.input}
            value={endYear}
            onChange={(event) => setEndYear(event.target.value)}
            disabled={disabled || saving}
          />
        </div>
        <button
          type="button"
          className={formSurface.secondaryButton}
          onClick={() => void handleSave()}
          disabled={disabled || saving}
        >
          {saving ? "Salvando…" : "Salvar referência"}
        </button>
      </div>
    </div>
  );
}
