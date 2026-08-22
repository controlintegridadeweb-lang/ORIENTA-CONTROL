type Props = {
  periodLabel: string;
  formVersion: number;
  organizationName: string;
  compact?: boolean;
};

/**
 * Metadados canônicos do formulário: organização em destaque,
 * período e versão como metadados secundários na mesma linha.
 */
export function RespondentFormContext({
  periodLabel,
  formVersion,
  organizationName,
  compact = false,
}: Props) {
  return (
    <div
      className={compact ? "space-y-1" : "space-y-1.5"}
      aria-label="Contexto do formulário"
    >
      <p
        className={
          compact
            ? "truncate text-sm text-slate-700"
            : "truncate text-sm text-slate-700 sm:text-[0.9375rem]"
        }
      >
        {organizationName || "—"}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-slate-600">
        <span>
          <span className="font-medium italic text-slate-500">Período:</span>{" "}
          {periodLabel || "—"}
        </span>
        <span>
          <span className="font-medium italic text-slate-500">Versão:</span>{" "}
          <span className="tabular-nums">{formVersion}</span>
        </span>
      </p>
    </div>
  );
}
