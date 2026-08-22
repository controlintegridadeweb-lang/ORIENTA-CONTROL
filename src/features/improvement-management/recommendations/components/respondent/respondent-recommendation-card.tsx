"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { RespondentRecommendationProgress } from "@/features/improvement-management/recommendations/components/respondent/respondent-recommendation-progress";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import {
  recommendationAxisSurface,
  recommendationCardShell,
} from "@/features/improvement-management/recommendations/components/recommendation-list-surface";
import {
  RECOMMENDATION_CARD_LABELS,
  type RecommendationCardViewModel,
} from "@/features/improvement-management/recommendations/components/respondent/recommendation-card-view-model";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  viewModel: RecommendationCardViewModel;
  recommendationType?: string;
};

function ContextBlock({
  formId,
  formLabel,
  formVersionLabel,
}: {
  formId: string;
  formLabel: string;
  formVersionLabel?: string;
}) {
  const formLine = formVersionLabel
    ? `${formLabel} · ${formVersionLabel}`
    : formLabel;

  return (
    <section aria-label="Contexto" className="space-y-3">
      <RecommendationCardField id={formId} label={RECOMMENDATION_CARD_LABELS.form}>
        <RecommendationCardText>{formLine}</RecommendationCardText>
      </RecommendationCardField>
    </section>
  );
}

function OriginBlock({
  questionId,
  originQuestion,
}: {
  questionId: string;
  originQuestion: string;
}) {
  return (
    <section aria-label="Origem">
      <RecommendationCardField
        id={questionId}
        label={RECOMMENDATION_CARD_LABELS.originQuestion}
      >
        <RecommendationCardText preWrap>
          {originQuestion || "—"}
        </RecommendationCardText>
      </RecommendationCardField>
    </section>
  );
}

function GuidanceBlock({
  recommendationId,
  displayCode,
  recommendationText,
  softBackground,
}: {
  recommendationId: string;
  displayCode?: string;
  recommendationText: string;
  softBackground: string;
}) {
  const label = displayCode
    ? `${RECOMMENDATION_CARD_LABELS.recommendation} ${displayCode}`
    : RECOMMENDATION_CARD_LABELS.recommendation;

  return (
    <section aria-label="Orientação">
      <RecommendationCardField id={recommendationId} label={label}>
        <div
          className={recommendationCardShell.guidancePanel}
          style={{ backgroundColor: softBackground }}
        >
          <RecommendationCardText variant="highlight" preWrap>
            {recommendationText}
          </RecommendationCardText>
        </div>
      </RecommendationCardField>
    </section>
  );
}

function TrackingBlock({
  situationId,
  progressId,
  actionSummary,
  actionCountLabel,
  lastUpdatedLabel,
  lastUpdatedIso,
  progressPercent,
  primaryAction,
}: {
  situationId: string;
  progressId: string;
  actionSummary: string;
  actionCountLabel?: string;
  lastUpdatedLabel?: string;
  lastUpdatedIso?: string;
  progressPercent?: number;
  primaryAction: RecommendationCardViewModel["primaryAction"];
}) {
  return (
    <section
      aria-label="Acompanhamento"
      className={recommendationCardShell.trackingDivider}
    >
      <RecommendationCardField id={situationId} label={RECOMMENDATION_CARD_LABELS.situation}>
        <RecommendationCardText variant="meta">{actionSummary}</RecommendationCardText>
        {actionCountLabel && actionCountLabel !== actionSummary ? (
          <RecommendationCardText variant="metaSecondary" className="mt-1">
            {actionCountLabel}
          </RecommendationCardText>
        ) : null}
      </RecommendationCardField>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-xs flex-1 space-y-2">
          {typeof progressPercent === "number" ? (
            <RecommendationCardField id={progressId} label={RECOMMENDATION_CARD_LABELS.progress}>
              <div className="flex items-center gap-2.5">
                <RecommendationCardText
                  variant="meta"
                  as="span"
                  className="shrink-0 tabular-nums"
                >
                  {progressPercent}%
                </RecommendationCardText>
                <div className="min-w-16 flex-1">
                  <RespondentRecommendationProgress value={progressPercent} size="sm" />
                </div>
              </div>
            </RecommendationCardField>
          ) : null}
          {lastUpdatedLabel ? (
            <RecommendationCardText variant="metaSecondary">
              {RECOMMENDATION_CARD_LABELS.lastUpdatedPrefix}{" "}
              <time dateTime={lastUpdatedIso}>{lastUpdatedLabel}</time>
            </RecommendationCardText>
          ) : null}
        </div>

        {primaryAction ? (
          <Link
            href={primaryAction.href}
            className={
              primaryAction.variant === "primary"
                ? `${formSurface.primaryButton} w-full justify-center sm:w-auto sm:min-w-44`
                : `${formSurface.secondaryButton} w-full justify-center sm:w-auto`
            }
          >
            {primaryAction.label}
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function SecondaryDetailsPanel({
  panelId,
  details,
}: {
  panelId: string;
  details: NonNullable<RecommendationCardViewModel["secondaryDetails"]>;
}) {
  return (
    <div
      id={panelId}
      className="space-y-3 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3.5 py-3.5 sm:px-4"
    >
      <RecommendationCardText variant="metaSecondary" as="p" className="uppercase tracking-wider">
        {RECOMMENDATION_CARD_LABELS.secondaryTitle}
      </RecommendationCardText>
      {details.reasonLabel ? (
        <RecommendationCardText variant="meta">
          {RECOMMENDATION_CARD_LABELS.reason}: {details.reasonLabel}
        </RecommendationCardText>
      ) : null}
      {details.observations ? (
        <div className="space-y-1">
          <RecommendationCardText variant="metaSecondary">
            {RECOMMENDATION_CARD_LABELS.observations}
          </RecommendationCardText>
          <RecommendationCardText preWrap>{details.observations}</RecommendationCardText>
        </div>
      ) : null}
    </div>
  );
}

export function RespondentRecommendationCard({ viewModel }: Props) {
  const baseId = useId();
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const hasSecondary = Boolean(viewModel.secondaryDetails);
  const panelId = `${baseId}-secondary`;
  const surface = recommendationAxisSurface(viewModel.axisName);

  return (
    <article
      className={`${recommendationCardShell.article}${
        secondaryOpen ? " ring-2 ring-sky-200 border-sky-300" : ""
      }`}
    >
      <span
        aria-hidden
        className={recommendationCardShell.accentRail}
        style={{ backgroundColor: surface.accent }}
      />
      <div className={`${recommendationCardShell.body} pl-5 sm:pl-6`}>
        <ContextBlock
          formId={`${baseId}-form`}
          formLabel={viewModel.formLabel}
          formVersionLabel={viewModel.formVersionLabel}
        />
        <OriginBlock
          questionId={`${baseId}-origin`}
          originQuestion={viewModel.originQuestion}
        />
        <GuidanceBlock
          recommendationId={`${baseId}-recommendation`}
          displayCode={viewModel.recommendationDisplayCode}
          recommendationText={viewModel.recommendationText}
          softBackground={surface.soft}
        />
        <TrackingBlock
          situationId={`${baseId}-situation`}
          progressId={`${baseId}-progress`}
          actionSummary={viewModel.actionSummary}
          actionCountLabel={viewModel.actionCountLabel}
          lastUpdatedLabel={viewModel.lastUpdatedLabel}
          lastUpdatedIso={viewModel.lastUpdatedIso}
          progressPercent={viewModel.progressPercent}
          primaryAction={viewModel.primaryAction}
        />

        {hasSecondary ? (
          <div className="space-y-3 border-t border-slate-200/70 pt-3">
            <button
              type="button"
              onClick={() => setSecondaryOpen((open) => !open)}
              aria-expanded={secondaryOpen}
              aria-controls={panelId}
              className={`${formSurface.secondaryButtonSm} self-start text-xs`}
            >
              <ChevronDown
                className={`h-4 w-4 text-brand-700 transition ${secondaryOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
              {secondaryOpen
                ? RECOMMENDATION_CARD_LABELS.hideSecondary
                : RECOMMENDATION_CARD_LABELS.showSecondary}
            </button>
            {secondaryOpen && viewModel.secondaryDetails ? (
              <SecondaryDetailsPanel panelId={panelId} details={viewModel.secondaryDetails} />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
