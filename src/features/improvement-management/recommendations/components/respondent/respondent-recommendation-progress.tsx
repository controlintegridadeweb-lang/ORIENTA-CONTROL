"use client";

type Props = {
  value: number;
  label?: string;
  size?: "sm" | "md";
};

/**
 * Mini barra de progresso para refletir a evolucao do plano de acao
 * (derivado em `respondent-presentation.ts`).
 */
export function RespondentRecommendationProgress({
  value,
  label,
  size = "md",
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    clamped >= 100
      ? "bg-emerald-500"
      : clamped >= 55
        ? "bg-sky-500"
        : clamped > 0
          ? "bg-amber-500"
          : "bg-slate-300";
  const height = size === "sm" ? "h-2" : "h-2.5";

  return (
    <div className="w-full space-y-1.5">
      {label ? (
        <div className="flex items-center justify-between text-micro font-medium text-slate-600">
          <span>{label}</span>
          <span className="tabular-nums font-semibold text-slate-800">{clamped}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={`relative w-full overflow-hidden rounded-full bg-slate-200/80 ${height}`}
      >
        <div
          className={`${tone} ${height} rounded-full shadow-sm transition-[width] duration-300 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
