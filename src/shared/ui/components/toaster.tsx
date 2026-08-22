"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * Toaster global da Plataforma Orienta.
 *
 * Padroniza posicao, duracao e estilo dos toasts em toda a aplicacao. E
 * montado no layout raiz; componentes individuais nao devem renderiza-lo.
 * Use o helper `notify` de `@/infrastructure/notifications/notify` para emitir toasts.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      expand
      duration={4000}
      gap={8}
      visibleToasts={5}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border shadow-card font-[var(--font-sans)] text-sm",
          title: "font-medium tracking-normal",
          description: "text-sm opacity-90",
          actionButton:
            "rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white",
          cancelButton:
            "rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700",
        },
      }}
    />
  );
}
