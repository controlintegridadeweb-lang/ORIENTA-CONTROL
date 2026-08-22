import type { ReactNode } from "react";
import { layout } from "@/shared/layout/design-system";

type Width = "form" | "wide" | "full";

const WIDTH_CLASS: Record<Width, string> = {
  /** Mesma largura do perfil do respondente. */
  form: "max-w-2xl",
  wide: "max-w-4xl",
  full: "max-w-none",
};

/** Área de conteúdo centralizada abaixo do hero — padrão do perfil. */
export function ProfileContentLayout({
  children,
  width = "form",
}: {
  children: ReactNode;
  width?: Width;
}) {
  return <div className={`mx-auto w-full ${WIDTH_CLASS[width]} ${layout.panelStack}`}>{children}</div>;
}
