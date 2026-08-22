import type { ReactNode } from "react";
import { formManagementUi } from "./form-management-ui";

type Width = "form" | "wide" | "full";

const WIDTH_CLASS: Record<Width, string> = {
  form: "max-w-3xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

type Props = {
  title: string;
  description?: string;
  width?: Width;
  children: ReactNode;
};

/**
 * Cabeçalho + conteúdo das abas de Gestão do formulário.
 * Sem ícone decorativo e sem card externo — as seções internas trazem a superfície.
 */
export function FormTabPanel({
  title,
  description,
  width = "full",
  children,
}: Props) {
  return (
    <div className={`mx-auto w-full ${WIDTH_CLASS[width]} ${formManagementUi.sectionStack}`}>
      <header>
        <h2 className={formManagementUi.tabTitle}>{title}</h2>
        {description ? (
          <p className={formManagementUi.tabDescription}>{description}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
};

/** Seção interna padronizada (título + descrição + conteúdo). */
export function FormManagementSection({
  title,
  description,
  children,
  actions,
}: SectionProps) {
  return (
    <section className={formManagementUi.blockStack}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className={formManagementUi.sectionTitle}>{title}</h3>
          {description ? (
            <p className={formManagementUi.sectionDescription}>{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
