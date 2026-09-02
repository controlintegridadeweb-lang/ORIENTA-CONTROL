"use client";

import {
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Toaster as SonnerToaster } from "sonner";

const ICON = "h-4 w-4";

/**
 * Toaster global da Plataforma Orienta.
 *
 * Padroniza posição, duração e estilo dos toasts em toda a aplicação. É
 * montado no layout raiz; componentes individuais não devem renderizá-lo.
 * Use o helper `notify` de `@/infrastructure/notifications/notify` para emitir toasts.
 * O CSS do Sonner 2 e o tema visual ficam em `src/app/globals.css`.
 */
export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="top-right"
      richColors
      closeButton
      expand
      duration={4000}
      gap={8}
      visibleToasts={5}
      offset={{ top: "5rem", right: "1rem" }}
      mobileOffset={{ top: "4.5rem", right: "1rem", left: "1rem" }}
      icons={{
        success: <CheckCircle2 className={ICON} aria-hidden />,
        error: <CircleAlert className={ICON} aria-hidden />,
        warning: <TriangleAlert className={ICON} aria-hidden />,
        info: <Info className={ICON} aria-hidden />,
        loading: <Loader2 className={`${ICON} animate-spin`} aria-hidden />,
        close: <X className="h-3.5 w-3.5" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm shadow-popover",
          title: "font-medium tracking-normal",
          description: "text-sm text-slate-600",
          actionButton:
            "rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white",
          cancelButton:
            "rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700",
          closeButton: "border-slate-200 bg-white text-slate-500",
        },
      }}
    />
  );
}
