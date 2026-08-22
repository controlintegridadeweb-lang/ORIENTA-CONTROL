"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { RecommendationStatusBadge } from "@/features/improvement-management/components/shared/recommendation-status-badge";
import { AdminRecommendationProgress } from "@/features/improvement-management/recommendations/components/admin/admin-recommendation-progress";
import {
  ADMIN_RECOMMENDATION_CARD_LABELS,
  toAdminRecommendationCardViewModel,
} from "@/features/improvement-management/recommendations/components/admin/admin-recommendation-card-view-model";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import {
  recommendationAxisSurface,
  recommendationCardShell,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";
import type { AdminRecommendationItem } from "@/features/improvement-management/recommendations/admin-presentation";
import { currentAdminListPath } from "@/shared/navigation/admin-navigation-context";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  item: AdminRecommendationItem;
  recommendationDisplayCode: string;
  showOrganization?: boolean;
};

export function AdminRecommendationHierarchyItem({
  item,
  recommendationDisplayCode,
  showOrganization = true,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = currentAdminListPath(pathname, searchParams.toString());
  const viewModel = toAdminRecommendationCardViewModel(item, recommendationDisplayCode, {
    returnTo,
    showOrganization,
  });
  const surface = recommendationAxisSurface(item.axisName);
  const formLine = viewModel.formVersionLabel
    ? `${viewModel.formLabel} · ${viewModel.formVersionLabel}`
    : viewModel.formLabel;
  const recommendationLabel = `${ADMIN_RECOMMENDATION_CARD_LABELS.recommendation} ${viewModel.recommendationDisplayCode}`;

  return (
    <article className={recommendationCardShell.article}>
      <span
        aria-hidden
        className={recommendationCardShell.accentRail}
        style={{ backgroundColor: surface.accent }}
      />
      <div className={`${recommendationCardShell.body} pl-5 sm:pl-6`}>
        <section aria-label="Contexto" className="space-y-3">
          <RecommendationCardField label={ADMIN_RECOMMENDATION_CARD_LABELS.form}>
            <RecommendationCardText>{formLine}</RecommendationCardText>
          </RecommendationCardField>
          {viewModel.organizationName ? (
            <RecommendationCardField label={ADMIN_RECOMMENDATION_CARD_LABELS.organization}>
              <RecommendationCardText>{viewModel.organizationName}</RecommendationCardText>
            </RecommendationCardField>
          ) : null}
        </section>

        <section aria-label="Origem">
          <RecommendationCardField label={ADMIN_RECOMMENDATION_CARD_LABELS.originQuestion}>
            <RecommendationCardText preWrap>
              {viewModel.originQuestion || "—"}
            </RecommendationCardText>
          </RecommendationCardField>
        </section>

        <section aria-label="Orientação">
          <RecommendationCardField label={recommendationLabel}>
            <div
              className={recommendationCardShell.guidancePanel}
              style={{ backgroundColor: surface.soft }}
            >
              <RecommendationCardText variant="highlight" preWrap>
                {viewModel.recommendationText}
              </RecommendationCardText>
            </div>
          </RecommendationCardField>
        </section>

        <section
          aria-label="Acompanhamento"
          className={recommendationCardShell.trackingDivider}
        >
          <RecommendationCardField label={ADMIN_RECOMMENDATION_CARD_LABELS.situation}>
            <div className="flex flex-wrap items-center gap-2">
              <RecommendationStatusBadge status={item.recommendationStatus} size="sm" />
              <RecommendationCardText variant="meta" as="span">
                {viewModel.actionCountLabel}
              </RecommendationCardText>
            </div>
          </RecommendationCardField>

          <RecommendationCardField label={ADMIN_RECOMMENDATION_CARD_LABELS.progress}>
            <div className="flex max-w-xs items-center gap-2.5">
              <RecommendationCardText variant="meta" as="span" className="shrink-0 tabular-nums">
                {viewModel.progress}%
              </RecommendationCardText>
              <div className="min-w-16 flex-1">
                <AdminRecommendationProgress
                  value={viewModel.progress}
                  overdue={viewModel.isOverdue}
                  size="xs"
                />
              </div>
            </div>
          </RecommendationCardField>

          <div className={recommendationCardShell.actions}>
            <Link href={viewModel.detailHref} className={formSurface.secondaryButtonSm}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {ADMIN_RECOMMENDATION_CARD_LABELS.detail}
            </Link>
            <Link href={viewModel.actionPlanHref} className={formSurface.primaryButtonSm}>
              {ADMIN_RECOMMENDATION_CARD_LABELS.actionPlan}
            </Link>
          </div>
        </section>
      </div>
    </article>
  );
}
