/** Estilos compartilhados dos formulários nas telas de autenticação (card branco institucional). */

import { typography } from "@/shared/layout/design-system";

export const AUTH_INPUT_CLASS =
  "h-[3.375rem] w-full rounded-lg border border-slate-200 bg-white px-4 text-sm leading-snug text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const AUTH_LABEL_CLASS = typography.fieldLabel;

export const AUTH_PRIMARY_BUTTON_CLASS =
  "flex h-[3.375rem] w-full items-center justify-center gap-2 rounded-lg bg-brand-700 text-sm font-medium text-white shadow-sm outline-none transition hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-700";

export function authAlertClass(kind: "error" | "success"): string {
  return kind === "success"
    ? "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-sm font-medium leading-relaxed text-emerald-950"
    : "rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium leading-relaxed text-red-600";
}
