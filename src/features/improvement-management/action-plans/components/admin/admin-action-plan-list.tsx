"use client";

import type { AdminPlanItem } from "@/features/improvement-management/action-plans/admin-monitoring";
import { AdminActionPlanTable } from "./admin-action-plan-table";

type Props = {
  items: AdminPlanItem[];
};

export function AdminActionPlanList({ items }: Props) {
  return (
    <div aria-label="Tabela de planos de ação">
      <AdminActionPlanTable items={items} />
    </div>
  );
}
