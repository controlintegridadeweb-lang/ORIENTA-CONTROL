import { levelMeta } from "@/features/fami/respondent-presentation";

const R = 54;
const STROKE = 10;
const CIRC = 2 * Math.PI * R;
const SIZE = 140;

type Props = {
  percentage: number;
  level: number;
  /** Omitir para exibir apenas o percentual central. */
  label?: string | null;
  /** Percentual central maior (ex.: score do diagnóstico). */
  emphasizePercent?: boolean;
  /**
   * `level`: arco na cor do nível de maturidade.
   * `brand`: arco verde institucional (resultado consolidado do diagnóstico).
   */
  ringTone?: "level" | "brand";
};

function formatPercentLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

export function FamiScoreRing({
  percentage,
  level,
  label,
  emphasizePercent,
  ringTone = "level",
}: Props) {
  const safe = Math.max(0, Math.min(100, percentage));
  const dash = (safe / 100) * CIRC;
  const meta = levelMeta(level);
  const c = SIZE / 2;
  const showLabel = label != null && label.length > 0;
  const ringClass = ringTone === "brand" ? "stroke-emerald-500" : meta.ringColor;
  const valueClass =
    ringTone === "brand" || emphasizePercent
      ? "text-slate-950"
      : meta.textColor;

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={
        showLabel
          ? `${label} ${safe.toFixed(1)} por cento`
          : `Pontuação FAMI ${safe.toFixed(1)} por cento`
      }
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={STROKE}
        />
        <circle
          cx={c}
          cy={c}
          r={R}
          fill="none"
          className={ringClass}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC - dash}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`font-bold tabular-nums tracking-tight ${valueClass} ${
            emphasizePercent ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
          }`}
        >
          {formatPercentLabel(safe)}
        </span>
        {showLabel ? (
          <span className="mt-0.5 max-w-22 text-2xs font-medium leading-tight text-slate-500">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
