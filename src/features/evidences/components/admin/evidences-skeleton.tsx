"use client";

import { TableSkeleton } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
export function EvidencesTableSkeleton() {
  return (
    <div className={formSurface.brandTable.wrapper}>
      <TableSkeleton rows={5} cols={6} className="p-4" />
    </div>
  );
}
