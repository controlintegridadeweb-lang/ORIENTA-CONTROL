"use client";

import type { ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

type TableFrameProps = {
  minWidthClassName: string;
  children: ReactNode;
};

/** Tabela operacional neutra: a cor comunica status/eixo nos dados, não na moldura. */
export function AdminMonitoringTableFrame({ minWidthClassName, children }: TableFrameProps) {
  return (
    <div className={formSurface.table.wrapper}>
      <table className={`${formSurface.table.table} ${minWidthClassName}`}>{children}</table>
    </div>
  );
}
