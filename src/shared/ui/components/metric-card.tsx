import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { typography } from "@/shared/layout/design-system";

export type MetricCardVariant = "neutral" | "info" | "success" | "warning" | "danger";

type StatusTone = "ok" | "attention" | "critical" | "neutral";

/**
 * Paleta semântica clara dos indicadores (tons 300).
 * A cor comunica significado na linha lateral; seleção usa anel institucional à parte.
 */
const VARIANT_STYLES: Record<
  MetricCardVariant,
  { accent: string; iconWrap: string; iconColor: string }
> = {
  neutral: {
    accent: "bg-slate-300",
    iconWrap: "bg-slate-50 ring-1 ring-slate-100",
    iconColor: "text-slate-500",
  },
  info: {
    accent: "bg-sky-300",
    iconWrap: "bg-sky-50 ring-1 ring-sky-100",
    iconColor: "text-sky-600",
  },
  success: {
    accent: "bg-emerald-300",
    iconWrap: "bg-emerald-50 ring-1 ring-emerald-100",
    iconColor: "text-emerald-600",
  },
  warning: {
    accent: "bg-amber-300",
    iconWrap: "bg-amber-50 ring-1 ring-amber-100",
    iconColor: "text-amber-600",
  },
  danger: {
    accent: "bg-red-300",
    iconWrap: "bg-red-50 ring-1 ring-red-100",
    iconColor: "text-red-500",
  },
};

/** Seleção de filtro/atalho — cor institucional, independente da variante semântica. */
const SELECTED_SURFACE = "border-sky-300 ring-2 ring-sky-200";

const STATUS_STYLES: Record<StatusTone, { dot: string; label: string; text: string }> = {
  ok: { dot: "bg-emerald-400", label: "Em dia", text: "text-emerald-700" },
  attention: { dot: "bg-amber-400", label: "Atenção", text: "text-amber-700" },
  critical: { dot: "bg-red-400", label: "Crítico", text: "text-red-700" },
  neutral: { dot: "bg-slate-300", label: "", text: "text-slate-500" },
};

const DENSITY = {
  comfortable: {
    root: "min-h-37",
    iconBox: "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
    value: `mt-4 ${typography.metricValue}`,
    mainRow: "items-start gap-4",
    padY: "py-[var(--card-padding-y)]",
  },
  compact: {
    root: "min-h-30",
    iconBox: "h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4",
    value: `mt-3 ${typography.metricValueCompact}`,
    mainRow: "items-start gap-3 sm:gap-3.5",
    padY: "py-3.5 sm:py-[var(--card-padding-y)]",
  },
} as const;

type MetricCardDensity = keyof typeof DENSITY;

export type MetricCardProps = {
  variant?: MetricCardVariant;
  density?: MetricCardDensity;
  label: string;
  value: ReactNode;
  /** Optional line under value / status (muted). */
  secondary?: ReactNode;
  icon?: LucideIcon;
  iconContainerClassName?: string;
  iconClassName?: string;
  status?: StatusTone;
  statusLabel?: string;
  valueClassName?: string;
  /** Native tooltip on the outer surface. */
  htmlTitle?: string;
  href?: string;
  ctaLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Destaca o card como filtro/atalho ativo (anel institucional, não a cor semântica). */
  selected?: boolean;
  /**
   * Cor da faixa lateral (ex.: cor do eixo FAMI). Quando omitida, usa a cor da `variant`.
   */
  accentColor?: string;
  /** Conteúdo entre o bloco de métrica e o CTA (ex.: barra de progresso). */
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  "aria-pressed"?: boolean | "mixed";
};

function mergeClasses(...parts: (string | undefined | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function MetricCard({
  variant = "neutral",
  density = "comfortable",
  label,
  value,
  secondary,
  icon: Icon,
  iconContainerClassName,
  iconClassName,
  status = "neutral",
  statusLabel,
  valueClassName,
  htmlTitle,
  href,
  ctaLabel,
  onClick,
  disabled,
  selected = false,
  accentColor,
  children,
  className,
  contentClassName,
  "aria-pressed": ariaPressed,
}: MetricCardProps) {
  const v = VARIANT_STYLES[variant];
  const den = DENSITY[density];
  const statusStyle = STATUS_STYLES[status];
  const showStatus = status !== "neutral" || Boolean(statusLabel);
  const finalStatusLabel = statusLabel ?? statusStyle.label;
  const interactive = Boolean(href || onClick);
  const showCta = Boolean(href && ctaLabel);
  const isSelected = selected || ariaPressed === true;
  const iconWrapDefault = iconContainerClassName
    ? mergeClasses(
        "flex shrink-0 items-center justify-center transition-colors",
        den.iconBox,
        iconContainerClassName,
      )
    : mergeClasses(
        "flex shrink-0 items-center justify-center transition-colors",
        den.iconBox,
        v.iconWrap,
      );
  const resolvedIconClass = iconClassName ?? v.iconColor;

  const inner = (
    <>
      <span
        aria-hidden
        className={mergeClasses(
          "pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[inherit]",
          accentColor ? undefined : v.accent,
        )}
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      />
      <div
        className={mergeClasses(
          "relative flex min-h-0 flex-1 flex-col",
          `pl-[max(1rem,calc(0.5rem+var(--card-padding-x)))] pr-[var(--card-padding-x)]`,
          den.padY,
          contentClassName,
        )}
      >
        <div className={mergeClasses("flex w-full min-w-0", den.mainRow)}>
          <div className="min-w-0 flex-1 py-0.5">
            <p className={typography.metricLabel}>{label}</p>
            <div
              className={
                valueClassName
                  ? mergeClasses(density === "compact" ? "mt-3" : "mt-4", valueClassName)
                  : den.value
              }
            >
              {value}
            </div>
            {(showStatus && finalStatusLabel) || secondary ? (
              <div className="mt-2 space-y-1">
                {showStatus && finalStatusLabel ? (
                  <p
                    className={mergeClasses(
                      "inline-flex items-center gap-1.5 text-sm font-medium",
                      statusStyle.text,
                    )}
                  >
                    <span
                      className={mergeClasses("inline-block h-1.5 w-1.5 rounded-full", statusStyle.dot)}
                      aria-hidden
                    />
                    {finalStatusLabel}
                  </p>
                ) : null}
                {secondary ? <div className={typography.metricSecondary}>{secondary}</div> : null}
              </div>
            ) : null}
          </div>
          {Icon ? (
            <div className={iconWrapDefault}>
              <Icon className={resolvedIconClass} aria-hidden />
            </div>
          ) : null}
        </div>
        {children ? <div className="mt-3 w-full min-w-0">{children}</div> : null}
        {showCta ? (
          <p className={mergeClasses("mt-auto pt-4", typography.metricCta)}>
            {ctaLabel}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </p>
        ) : null}
      </div>
    </>
  );

  const surfaceClass = mergeClasses(
    "group relative flex h-full w-full min-w-0 overflow-hidden rounded-xl border border-slate-200/95 bg-white text-left shadow-card transition",
    interactive && !disabled
      ? "hover:border-slate-300/90 hover:shadow-card-hover"
      : "",
    interactive && onClick && !href && !disabled ? "cursor-pointer hover:-translate-y-0.5" : "",
    isSelected ? SELECTED_SURFACE : "",
    den.root,
    disabled ? "pointer-events-none opacity-60" : "",
    className,
  );

  const root = (
    <article title={htmlTitle} className={mergeClasses(surfaceClass, "flex flex-col")}>
      {inner}
    </article>
  );

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        {root}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        disabled={disabled}
        title={htmlTitle}
        onClick={onClick}
        aria-pressed={ariaPressed}
        className={mergeClasses(
          surfaceClass,
          "flex flex-col p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
        )}
      >
        {inner}
      </button>
    );
  }

  return root;
}

/** Placeholder row matching `MetricCard` comfortable density (loading states). */
export function MetricCardSkeleton({
  className,
  showIcon = true,
}: {
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <div
      className={mergeClasses(
        "relative flex min-h-37 w-full min-w-0 overflow-hidden rounded-xl border border-slate-200/95 bg-white shadow-card",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[inherit] bg-slate-300"
      />
      <div
        className="flex w-full flex-1 items-start gap-4 pl-[max(1rem,calc(0.5rem+var(--card-padding-x)))] pr-[var(--card-padding-x)] py-[var(--card-padding-y)]"
      >
        <div className="min-w-0 flex-1 py-0.5">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200/90" />
          <div className="mt-4 h-10 w-20 animate-pulse rounded-md bg-slate-200/80" />
        </div>
        {showIcon ? (
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100/90" />
        ) : null}
      </div>
    </div>
  );
}
