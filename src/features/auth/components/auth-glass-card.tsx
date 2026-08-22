import type { ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

/** Cartão branco sólido para formulários de autenticação — visual institucional, sem vidro nem gradientes. */
export function AuthGlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${formSurface.dashboardPanel} p-6 sm:p-10 lg:p-12 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
