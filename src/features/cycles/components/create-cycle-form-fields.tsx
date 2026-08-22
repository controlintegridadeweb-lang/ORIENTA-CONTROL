import Link from "next/link";
import { countLabel } from "@/shared/format/count-label";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import type { CyclesBatchReport } from "@/features/cycles/client";
import { formSurface } from "@/shared/layout/form-surface";

export function FlowSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={`space-y-4 ${formSurface.subtlePanel}`}>
      <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs text-sky-800">{number}</span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function ChoiceCard({
  name,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 border-slate-300 text-brand focus:ring-brand/30"
      />
      <span>
        <strong className="block text-sm text-slate-900">{title}</strong>
        <span className="mt-0.5 block text-xs text-slate-600">{description}</span>
      </span>
    </label>
  );
}

export function ProgrammedDate({
  checked,
  onCheckedChange,
  title,
  description,
  inputId,
  value,
  onValueChange,
  error,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description: string;
  inputId: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className={formSurface.subtlePanel}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
        />
        <span>
          <strong className="block text-sm text-slate-900">{title}</strong>
          <span className="mt-0.5 block text-xs text-slate-600">{description}</span>
        </span>
      </label>
      {checked ? (
        <div className="mt-3 max-w-sm">
          <label htmlFor={inputId} className={formSurface.label}>Data e hora</label>
          <input
            id={inputId}
            type="datetime-local"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className={formSurface.input}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            required
          />
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BatchReport({
  report,
  orgLabel,
  formId,
  periodLabel,
}: {
  report: CyclesBatchReport;
  orgLabel: (id: string) => string;
  formId: string;
  periodLabel: string;
}) {
  const { created, updatedDrafts, opened, skipped, failed, schedules } = report;
  const successCount = created.length + updatedDrafts.length + opened.length;
  const hasSuccess = successCount > 0;
  const tone = failed.length > 0
    ? formSurface.messageError
    : hasSuccess
      ? formSurface.messageSuccess
      : formSurface.messageWarning;
  const panelHref = `/admin/ciclos?formId=${encodeURIComponent(formId)}&q=${encodeURIComponent(periodLabel)}`;

  return (
    <div
      role={failed.length > 0 ? "alert" : "status"}
      aria-label="Resultado da criação de diagnósticos"
      aria-live={failed.length > 0 ? "assertive" : "polite"}
      className={`${tone} space-y-2`}
    >
      <div className="flex items-center gap-2 font-medium">
        {hasSuccess ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
        <span>
          {report.mode === "open"
            ? countLabel(opened.length, "diagnóstico aberto", "diagnósticos abertos")
            : report.mode === "schedule"
              ? countLabel(created.length + updatedDrafts.length, "diagnóstico preparado para abertura", "diagnósticos preparados para abertura")
              : countLabel(created.length, "rascunho criado", "rascunhos criados")}
          {failed.length > 0 ? `; ${countLabel(failed.length, "falha", "falhas")}` : ""}.
        </span>
      </div>

      {updatedDrafts.length > 0 ? <p>{countLabel(updatedDrafts.length, "rascunho existente foi reutilizado", "rascunhos existentes foram reutilizados")}.</p> : null}
      {schedules.jobsCreated > 0 ? (
        <p>{countLabel(schedules.jobsCreated, "ação programada", "ações programadas")}, incluindo {countLabel(schedules.remindersScheduled, "lembrete", "lembretes")}.</p>
      ) : null}
      {skipped.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {skipped.map((item) => (
            <li key={`${item.organizationId}-${item.cycleId ?? "none"}`}>
              <strong>{orgLabel(item.organizationId)}:</strong> {item.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {failed.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {failed.map((item) => (
            <li key={item.organizationId}>
              <strong>{orgLabel(item.organizationId)}:</strong> {item.message}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={panelHref} className="inline-flex items-center gap-1 font-medium text-sky-800 hover:underline">
        Ver diagnósticos do período <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
