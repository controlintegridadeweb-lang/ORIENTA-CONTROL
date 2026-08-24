"use client";

import type { ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

type TableFrameProps = {
  minWidthClassName: string;
  children: ReactNode;
};

/** Células de texto longo com limite visual para não invadir colunas vizinhas. */
export const adminMonitoringTableTextCell = `${formSurface.brandTable.cell} max-w-56 align-middle`;

export const adminMonitoringTableClamp =
  "line-clamp-2 break-words [overflow-wrap:anywhere]";

/** Tabela institucional de monitoramento (mesmo desenho de formulários/evidências). */
export function AdminMonitoringTableFrame({ minWidthClassName, children }: TableFrameProps) {
  return (
    <div className={formSurface.brandTable.wrapper}>
      <table className={`${formSurface.brandTable.table} ${minWidthClassName}`}>{children}</table>
    </div>
  );
}
