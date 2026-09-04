const SIZE = 168;
const RADIUS = 64;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  percentage: number;
  label: string;
  ariaLabel: string;
};

export function ProgressRing({ percentage, label, ariaLabel }: Props) {
  const safe = Math.max(0, Math.min(100, percentage));
  const dash = (safe / 100) * CIRCUMFERENCE;
  const center = SIZE / 2;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} role="img" aria-label={ariaLabel}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
          <circle
            cx={center}
            cy={center}
            r={RADIUS}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={STROKE}
          />
          <circle
            cx={center}
            cy={center}
            r={RADIUS}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-slate-950 md:text-4xl">
            {Math.round(safe)}%
          </span>
          <span className="mt-0.5 text-xs font-medium text-slate-500">{label}</span>
        </div>
      </div>
    </div>
  );
}
