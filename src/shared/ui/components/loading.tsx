import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

/**
 * Primitivos de loading da Plataforma Orienta.
 *
 * Evite estilizar Loader2 manualmente — use <Spinner> para qualquer
 * indicador inline e <LoadingButton> para botoes de acao com pending.
 *
 * Todos respeitam `prefers-reduced-motion` via globals.css.
 */

const SPINNER_SIZES = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
} as const;

export type SpinnerSize = keyof typeof SPINNER_SIZES;

export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}) {
  const sizeClass = SPINNER_SIZES[size];
  const merged = className ? `${sizeClass} ${className}` : sizeClass;
  return (
    <Loader2
      className={`animate-spin ${merged}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export type LoadingButtonProps = Omit<ButtonProps, "children"> & {
  pending: boolean;
  pendingLabel?: string;
  spinnerSize?: SpinnerSize;
  children: ReactNode;
};

/**
 * Botao com estado pending: troca o conteudo por spinner + label,
 * mantem `aria-busy` e desabilita interacao. Mantenha o handler de
 * submissao no `onClick` ou no form pai como faria normalmente.
 */
export function LoadingButton({
  pending,
  pendingLabel,
  spinnerSize = "sm",
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
      {...rest}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner size={spinnerSize} />
          {pendingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  const base = formSurface.skeleton;
  return (
    <div
      aria-hidden
      className={className ? `${base} ${className}` : base}
    />
  );
}
/**
 * Skeleton de tabela: cabecalho + linhas. Usar dentro do shell quando
 * a area carrega dados tabulares.
 */
export function TableSkeleton({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Carregando lista"
      className={className ? `space-y-3 ${className}` : "space-y-3"}
    >
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, index) => (
          <Skeleton key={`h-${index}`} className="h-3.5 w-2/3" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-3 rounded-lg border border-slate-100 bg-white p-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }, (_, colIndex) => (
              <Skeleton
                key={`${rowIndex}-${colIndex}`}
                className={`h-4 ${colIndex === 0 ? "w-3/4" : "w-1/2"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * Indicador inline de carregamento dentro de um painel ou card.
 * Use quando um bloco especifico esta carregando, sem dominar a tela.
 */
export function InlineLoader({
  label = "Carregando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        className ??
        "inline-flex items-center gap-2 text-sm text-slate-600"
      }
    >
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}
