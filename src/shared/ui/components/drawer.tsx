"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { trapTabFocus, visibleFocusableElements } from "@/shared/accessibility/focus-trap";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Footer actions (ex.: botoes secundarios). */
  footer?: ReactNode;
};

/**
 * Painel lateral direito em desktop; fullscreen em mobile. Overlay com
 * fechamento por clique e Esc. Focus trap simples no painel.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DrawerProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    const panel = panelRef.current;
    if (panel) visibleFocusableElements(panel)[0]?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-hidden={false}>
      <button
        type="button"
        aria-label="Fechar painel"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="relative flex h-full w-full min-w-0 max-h-full max-w-screen flex-col border-l border-slate-200 bg-white shadow-2xl md:max-w-135 md:shadow-xl"
        tabIndex={-1}
        onKeyDown={(event) => trapTabFocus(event, panelRef.current)}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-100/70 bg-brand-50 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={typography.subsectionTitle}>
              {title}
            </h2>
            {description ? (
              <p id={descId} className={typography.sectionDescription}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${formSurface.ghostButton} min-h-10 min-w-10 shrink-0 text-slate-600`}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/40 px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
