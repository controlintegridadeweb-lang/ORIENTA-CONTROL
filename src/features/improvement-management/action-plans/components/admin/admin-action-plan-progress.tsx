"use client";

type Props = {
  value: number;
  overdue?: boolean;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
};

function color(value: number, overdue: boolean): string {
  if (overdue) return "bg-rose-500";
  if (value >= 100) return "bg-brand";
  if (value >= 75) return "bg-brand-500";
  if (value >= 50) return "bg-brand-500";
  if (value > 0) return "bg-brand-400";
  return "bg-slate-300";
}

export function AdminActionPlanProgress({
  value,
  overdue = false,
  size = "sm",
  showLabel = true,
}: Props) {
  const safe = Math.max(0, Math.min(100, value));
  const h = size === "xs" ? "h-1" : size === "md" ? "h-2" : "h-1.5";
  return (
    <div className="flex w-full flex-col gap-1">
      <div
        className={`${h} w-full overflow-hidden rounded-full bg-slate-100`}
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${h} ${color(safe, overdue)} rounded-full transition-all`}
          style={{ width: `${safe}%` }}
        />
      </div>
      {showLabel ? (
        <p className="text-2xs font-semibold tabular-nums text-slate-500">
          {safe}%
        </p>
      ) : null}
    </div>
  );
}
