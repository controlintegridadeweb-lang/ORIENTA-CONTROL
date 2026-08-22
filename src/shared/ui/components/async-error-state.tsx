"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { LoadingButton } from "@/shared/ui/components/loading";

type AsyncErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
};

/**
 * Feedback visual para falhas de leitura assíncrona.
 *
 * Mantém erro, vazio e loading como estados distintos e oferece recuperação
 * local sem descartar filtros ou o restante da tela.
 */
export function AsyncErrorState({
  message,
  title = "Não foi possível carregar os dados",
  onRetry,
  retrying = false,
  retryLabel = "Tentar novamente",
  compact = false,
  className,
}: AsyncErrorStateProps) {
  const spacing = compact ? "gap-3 px-3 py-3" : "gap-4 px-4 py-4";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${formSurface.messageError} flex flex-wrap items-start justify-between ${spacing}${className ? ` ${className}` : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className={typography.errorText}>{title}</p>
          <p className={`mt-0.5 ${typography.auxiliary}`}>{message}</p>
        </div>
      </div>

      {onRetry ? (
        <LoadingButton
          type="button"
          pending={retrying}
          pendingLabel="Tentando novamente…"
          onClick={() => void onRetry()}
          className={`${formSurface.secondaryButtonSm} shrink-0`}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {retryLabel}
        </LoadingButton>
      ) : null}
    </div>
  );
}
