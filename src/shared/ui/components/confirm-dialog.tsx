"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { trapTabFocus } from "@/shared/accessibility/focus-trap";

/**
 * Diálogo de confirmação da Plataforma Orienta.
 *
 * Substitui os pop-ups nativos (`window.confirm`) por um modal com o design da
 * plataforma. Uso imperativo via hook, análogo ao `notify` para toasts:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Abrir diagnóstico?" }))) return;
 *
 * O `<ConfirmProvider>` é montado uma vez no layout raiz; nenhum componente
 * precisa renderizar o diálogo diretamente.
 */

type ConfirmTone = "default" | "danger";

export type ConfirmOptions = {
  title: string;
  /** Texto de apoio (aceita nós React para ênfases). */
  description?: ReactNode;
  /** Rótulo do botão de confirmação. Padrão: "Confirmar". */
  confirmLabel?: string;
  /** Rótulo do botão de cancelamento. Padrão: "Cancelar". */
  cancelLabel?: string;
  /** `danger` usa estilo/ícone de ação destrutiva e foca o "Cancelar". */
  tone?: ConfirmTone;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      // Se já há uma confirmação pendente (caso raro), resolve a anterior como
      // negada para não deixar promessas penduradas.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <ConfirmDialog
          options={options}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

type ConfirmDialogProps = {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const { title, description, tone = "default" } = options;
  const confirmLabel = options.confirmLabel ?? "Confirmar";
  const cancelLabel = options.cancelLabel ?? "Cancelar";
  const isDanger = tone === "danger";

  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Em ações destrutivas, o foco inicial vai para "Cancelar" (opção segura).
    const initial = isDanger ? cancelRef.current : confirmRef.current;
    initial?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isDanger, onCancel]);

  const Icon = isDanger ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <button
        type="button"
        aria-label={cancelLabel}
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="relative flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-100/80"
        onKeyDown={(event) => trapTabFocus(event, panelRef.current)}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isDanger ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-700"
              }`}
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className={typography.subsectionTitle}>
                {title}
              </h2>
              {description ? (
                <div id={descId} className={typography.sectionDescription}>
                  {description}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`${formSurface.secondaryButton} w-full sm:w-auto`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`${isDanger ? formSurface.dangerButton : formSurface.primaryButton} w-full sm:w-auto`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
