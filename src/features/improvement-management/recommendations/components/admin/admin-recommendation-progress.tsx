"use client";

type Props = {
  value: number;
  overdue?: boolean;
  size?: "xs" | "sm";
};

/**
 * Barra alinhada ao `RespondentRecommendationProgress` (tons por faixa),
 * com destaque em rosa quando `overdue`.
 */
export function AdminRecommendationProgress({
  value,
  overdue = false,
  size = "sm",
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tone = overdue
    ? "bg-rose-500"
    : clamped >= 100
      ? "bg-emerald-500"
      : clamped >= 55
        ? "bg-sky-500"
        : clamped > 0
          ? "bg-amber-500"
          : "bg-slate-300";
  const height = size === "xs" ? "h-1" : "h-1.5";

  return (
    <div className="w-full space-y-1">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`relative w-full overflow-hidden rounded-full bg-slate-100 ${height}`}
      >
        <div
          className={`${tone} ${height} rounded-full transition-[width] duration-300 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
