"use client";

import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  id?: string;
  /** Rótulo acessível (ex.: "Ano de referência") */
  label: string;
  hint?: string;
  /** Anos disponíveis; omita e use `minYear`+`maxYear` para gerar o intervalo. */
  years?: number[];
  /** Limite inferior (filtra `years` ou gera lista com `maxYear`). */
  minYear?: number;
  /** Limite superior (filtra `years` ou gera lista com `minYear`). */
  maxYear?: number;
  /** `null` = todos os anos (último FAMI atual) */
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  /** Exibe opção “Todos os anos” (padrão: sim). */
  includeAllOption?: boolean;
  className?: string;
  /** Sobrescreve a tipografia padrão do rótulo (ex.: título de seção). */
  labelClassName?: string;
};

function resolveYearOptions(years: number[] | undefined, minYear?: number, maxYear?: number): number[] {
  if (years?.length) {
    let list = [...new Set(years)];
    if (minYear != null) list = list.filter((y) => y >= minYear);
    if (maxYear != null) list = list.filter((y) => y <= maxYear);
    return list;
  }
  if (minYear != null && maxYear != null) {
    const generated: number[] = [];
    for (let y = maxYear; y >= minYear; y--) generated.push(y);
    return generated;
  }
  return [];
}

/**
 * Seletor de ano civil BRT para filtro “fechamento anual”.
 * Lista “Todos os anos” + anos em ordem decrescente (mais recente primeiro na lista estável pela prop).
 */
export function YearSelect({
  id,
  label,
  hint,
  years,
  minYear,
  maxYear,
  value,
  onChange,
  disabled,
  includeAllOption = true,
  className = "",
  labelClassName,
}: Props) {
  const uniqueSorted = resolveYearOptions(years, minYear, maxYear).sort((a, b) => b - a);

  return (
    <label
      className={`block min-w-0 w-full ${formSurface.fieldGroup} ${className}`.trim()}
      htmlFor={id}
    >
      <span className={labelClassName ?? formSurface.label}>{label}</span>
      <select
        id={id}
        value={value == null ? "" : String(value)}
        disabled={disabled}
        className={formSurface.inputSelect}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        aria-describedby={hint ? `${id ?? "year"}-hint` : undefined}
      >
        {includeAllOption ? <option value="">Todos os anos</option> : null}
        {uniqueSorted.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      {hint ? (
        <span id={`${id ?? "year"}-hint`} className="text-micro leading-relaxed text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
