"use client";

import { useState } from "react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
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
  embedded = false,
}: {
  cycle: ReportCycleOption;
  disabled: boolean;
  onSaved(reference: { referenceStartYear: number; referenceEndYear: number }): Promise<void>;
  /** When true, omit outer card chrome (parent already provides the surface). */
  embedded?: boolean;
}) {
  const [startYear, setStartYear] = useState(cycle.referenceStartYear?.toString() ?? "");
  const [endYear, setEndYear] = useState(cycle.referenceEndYear?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  if (cycle.referenceStartYear != null && cycle.referenceEndYear != null) {
    return (
      <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-x-3">
        <dt className={typography.meta}>Referência institucional</dt>
        <dd className="text-sm font-medium text-slate-800">
          {periodLabel(cycle.referenceStartYear, cycle.referenceEndYear)}
        </dd>
      </dl>
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

  const editor = (
    <>
      <p className={typography.cardTitle}>Defina a referência institucional</p>
      <p className={`mt-1 ${typography.cardDescription}`}>
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
    </>
  );

  if (embedded) {
    return (
      <div className="-mx-4 -my-3.5 border-l-4 border-l-amber-400 bg-white px-4 py-4 sm:-mx-5 sm:px-5">
        {editor}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-l-4 border-l-amber-400 px-4 py-4 sm:px-5">{editor}</div>
    </div>
  );
}
