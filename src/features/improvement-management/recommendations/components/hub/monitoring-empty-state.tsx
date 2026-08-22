"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { withRespondentReturnPath } from "@/shared/navigation/respondent-navigation-context";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { useRecommendationDetailContext } from "./recommendation-detail-context";

export function MonitoringEmptyState() {
  const { detailBasePath, role, listPath } = useRecommendationDetailContext();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? listPath;
  const hrefBase = `${detailBasePath}/acoes?new=1`;
  const href =
    role === "admin"
      ? withAdminReturnPath(hrefBase, returnTo)
      : withRespondentReturnPath(hrefBase, returnTo);

  return (
    <div className={`${formSurface.empty.container} border-dashed px-6 py-14 text-center`}>
      <p className={formSurface.empty.title}>Monitoramento indisponível</p>
      <p className={formSurface.empty.description}>
        O monitoramento ficará disponível após o cadastro da primeira ação.
      </p>
      <Link
        href={href}
        className={`${formSurface.primaryButtonSm} mt-4 inline-flex items-center gap-1.5`}
      >
        Criar primeira ação
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
