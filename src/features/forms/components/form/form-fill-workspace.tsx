import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

const ws = formSurface.formWorkspace;

type Props = {
  backHref: string;
  backLabel?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Workspace centralizado para preenchimento de formulários (estilo Google Forms).
 * Usar com `PageShell` em modo canvas (`isFormFillRoute`).
 */
export function FormFillWorkspace({
  backHref,
  backLabel = "Voltar",
  title,
  subtitle,
  actions,
  children,
}: Props) {
  return (
    <div className={ws.inner}>
      <Link href={backHref} className={ws.backLink}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>
      <article className={ws.shell}>
        <header className={ws.header}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className={ws.title}>{title}</h2>
              {subtitle ? <div className={ws.subtitle}>{subtitle}</div> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </header>
        {children}
      </article>
    </div>
  );
}
