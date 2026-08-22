"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";
import { PageHeader } from "@/shared/ui/components/page-header";
import type { FormManagementDetails } from "../types";
import { useFormManagementController } from "./useFormManagementController";
import { FormManagementHistorySection } from "./form-management-history-section";
import { FormManagementOverviewSection } from "./form-management-overview-section";
import { FormManagementOrganizationsSection } from "./form-management-organizations-section";
import { FormManagementActionsSection } from "./form-management-actions-section";

export function FormManagementShell({
  details: initialDetails,
  returnTo,
}: {
  details: FormManagementDetails;
  returnTo: string;
}) {
  const controller = useFormManagementController(initialDetails);
  const { details, startOrganizationAction } = controller;

  return (
    <div className={layout.pageStack}>
      <PageHeader
        kicker="Detalhes e gestão do formulário"
        title={details.formName}
        description={`Versão ${details.formVersion || "—"} · Período ${details.periodLabel || "—"}`}
        actions={
          <Link href={returnTo} className={formSurface.secondaryButtonSm}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao acompanhamento
          </Link>
        }
        size="compact"
      />

      <FormManagementOverviewSection details={details} />
      <FormManagementOrganizationsSection
        details={details}
        startOrganizationAction={startOrganizationAction}
      />
      <FormManagementActionsSection controller={controller} />
      <FormManagementHistorySection history={details.history} />
    </div>
  );
}
