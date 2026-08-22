import { formSurface } from "@/shared/layout/form-surface";

/** Layout base compartilhado por todos os badges de status (discreto, sem ícone por padrão). */
export const statusPillBase = formSurface.badge.base;

type StatusPillProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

export function StatusPill({ children, className = "", title, "aria-label": ariaLabel }: StatusPillProps) {
  return (
    <span
      className={`${statusPillBase} ${className}`.trim()}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}
