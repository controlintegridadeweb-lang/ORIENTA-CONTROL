import { toast } from "sonner";

/**
 * Sistema de feedback transitorio (toasts) da Plataforma Orienta.
 *
 * Use `notify.*` em vez de chamar `toast` direto para que a troca de lib
 * (ou ajuste de defaults globais) fique centralizada aqui.
 *
 * Convencao:
 * - Feedback de acao (salvou, removeu, falhou ao publicar) => toast.
 * - Erro de validacao de campo (input invalido) => mensagem inline no form.
 * - Para acoes assincronas com inicio/fim claros, prefira `notify.promise`.
 */

type NotifyId = string | number;

type NotifyOptions = {
  id?: NotifyId;
  description?: string;
  duration?: number;
};

type NotifyPromiseMessages<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
};

export const notify = {
  success(message: string, options?: NotifyOptions): NotifyId {
    return toast.success(message, options);
  },

  error(message: string, options?: NotifyOptions): NotifyId {
    return toast.error(message, { duration: 6000, ...options });
  },

  warning(message: string, options?: NotifyOptions): NotifyId {
    return toast.warning(message, { duration: 5000, ...options });
  },

  info(message: string, options?: NotifyOptions): NotifyId {
    return toast(message, options);
  },

  loading(message: string, options?: NotifyOptions): NotifyId {
    return toast.loading(message, options);
  },

  promise<T>(promise: Promise<T>, messages: NotifyPromiseMessages<T>) {
    return toast.promise(promise, messages);
  },

  dismiss(id?: NotifyId) {
    return toast.dismiss(id);
  },
};

/**
 * Extrai uma mensagem util de qualquer erro lancado por server actions
 * ou clientes Supabase. Use em catch blocks antes de chamar `notify.error`.
 */
export function describeError(error: unknown, fallback = "Algo deu errado."): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

/**
 * Detecta o erro especial que o Next.js lanca durante `redirect()` em
 * server actions. Esses erros NAO sao falhas de aplicacao: precisam ser
 * re-lancados para que o framework conclua a navegacao.
 */
export function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
