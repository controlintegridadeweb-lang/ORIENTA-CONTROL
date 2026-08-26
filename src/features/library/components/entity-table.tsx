"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { ColumnSpec, EntityConfig } from "@/features/library/config";
import {
  LIBRARY_RECOMMENDATION_TYPE_LABEL,
  LIBRARY_STATUS_LABEL,
} from "@/features/library/config";
import type { LibraryCatalogItem, LibraryItemStatus } from "@/features/library/types";
import type { LibraryTransition } from "@/features/library/client";
import { formSurface } from "@/shared/layout/form-surface";
import { readRecordField } from "@/shared/validation/runtime";
import { LifecycleMenu } from "./lifecycle-menu";

export type EntityTableProps = {
  config: EntityConfig;
  items: LibraryCatalogItem[];
  onEdit: (item: LibraryCatalogItem) => void;
  onDelete: (item: LibraryCatalogItem) => void;
  onTransition: (
    item: LibraryCatalogItem,
    action: LibraryTransition,
    payload: { justification?: string | null },
  ) => Promise<void>;
  disabled?: boolean;
};

const STATUS_BADGE: Record<
  LibraryItemStatus,
  Exclude<keyof typeof formSurface.badge, "base">
> = {
  draft: "neutral",
  in_review: "warning",
  published: "brand",
  deprecated: "danger",
  archived: "neutral",
};

function renderCell(column: ColumnSpec, item: LibraryCatalogItem): React.ReactNode {
  const raw = readRecordField(item, column.key);
  if (column.key === "status" && typeof raw === "string") {
    const status = raw as LibraryItemStatus;
    const variant = STATUS_BADGE[status] ?? "neutral";
    return (
      <span className={`${formSurface.badge.base} ${formSurface.badge[variant]}`}>
        {LIBRARY_STATUS_LABEL[status]}
      </span>
    );
  }
  if (column.key === "tags" && Array.isArray(raw)) {
    if ((raw as string[]).length === 0) return "—";
    return (
      <span className="flex flex-wrap gap-1">
        {(raw as string[]).map((tag) => (
          <span
            key={tag}
            className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
          >
            {tag}
          </span>
        ))}
      </span>
    );
  }
  if (raw === null || raw === undefined || raw === "") return "—";
  if (column.key === "tipo") {
    return (
      LIBRARY_RECOMMENDATION_TYPE_LABEL[
        raw as keyof typeof LIBRARY_RECOMMENDATION_TYPE_LABEL
      ] ?? String(raw)
    );
  }
  if (column.key === "name" || column.key === "title") {
    return <span className="font-semibold text-slate-900">{String(raw)}</span>;
  }
  if (column.key === "description") {
    return (
      <span className="line-clamp-2 max-w-md text-slate-600" title={String(raw)}>
        {String(raw)}
      </span>
    );
  }
  if (typeof raw === "number") return <span className="tabular-nums">{String(raw)}</span>;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

export function EntityTable({
  config,
  items,
  onEdit,
  onDelete,
  onTransition,
  disabled,
}: EntityTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 px-4 py-10 text-center text-sm text-slate-600">
        {config.emptyLabel}
      </div>
    );
  }

  return (
    <div className={formSurface.brandTable.wrapper}>
      <table className={`${formSurface.brandTable.table} min-w-230`}>
        <thead className={formSurface.brandTable.head}>
          <tr>
            {config.columns.map((column) => (
              <th
                key={column.key}
                className={`${formSurface.brandTable.headCell} ${column.width ?? ""} ${
                  column.align === "right" ? "text-right" : ""
                }`}
              >
                {column.label}
              </th>
            ))}
            <th className={`${formSurface.brandTable.headCell} min-w-28`}>Publicação</th>
            <th className={`${formSurface.brandTable.headCell} w-28 text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              className={index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd}
            >
              {config.columns.map((column) => (
                <td
                  key={column.key}
                  className={`${
                    column.key === "code" || column.key === "axisCode"
                      ? formSurface.brandTable.cellMuted
                      : formSurface.brandTable.cell
                  } align-middle ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {renderCell(column, item)}
                </td>
              ))}
              <td className={`${formSurface.brandTable.cell} align-middle`}>
                <LifecycleMenu
                  status={item.status}
                  disabled={disabled}
                  onRun={(action, payload) => onTransition(item, action, payload)}
                />
              </td>
              <td className={`${formSurface.brandTable.cell} align-middle text-right`}>
                <div className="inline-flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    disabled={disabled}
                    className={`${formSurface.ghostButton} h-9 w-9 px-0`}
                    aria-label={`Editar ${config.singular}`}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={disabled}
                    className={`${formSurface.ghostButton} h-9 w-9 px-0 text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
                    aria-label={`Excluir ${config.singular}`}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
