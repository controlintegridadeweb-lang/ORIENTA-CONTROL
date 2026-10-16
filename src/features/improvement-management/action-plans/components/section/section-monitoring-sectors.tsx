import { actionNumberInSection } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import {
  OverviewBlockTitle,
  OverviewSoftPanel,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import {
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import { countLabel } from "@/shared/format/count-label";

type SectorAction = {
  id: string;
  label: string;
  text: string;
  progress: number;
};

export type SectionSectorGroup = {
  sector: string;
  actions: SectorAction[];
};

export function sectionActionsBySector(section: SectionActionPlanGroup): SectionSectorGroup[] {
  const groups = new Map<string, SectorAction[]>();

  section.recommendations.forEach((recommendation, recommendationIndex) => {
    recommendation.actions.forEach((action, actionIndex) => {
      const sector = action.responsibleSector.trim() || "Não informado";
      const rows = groups.get(sector) ?? [];
      rows.push({
        id: action.id,
        label: `A${actionNumberInSection(section, recommendationIndex, actionIndex)}`,
        text: action.actionText,
        progress: action.progressPercentage,
      });
      groups.set(sector, rows);
    });
  });

  return [...groups.entries()]
    .map(([sector, actions]) => ({ sector, actions }))
    .sort(
      (left, right) =>
        right.actions.length - left.actions.length ||
        left.sector.localeCompare(right.sector, "pt-BR"),
    );
}

export function SectionMonitoringSectors({ section }: { section: SectionActionPlanGroup }) {
  const groups = sectionActionsBySector(section);
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="section-sectors-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="section-sectors-heading"
        title="Setores responsáveis"
        description="Quais áreas estão com cada ação desta seção."
      />
      <div className="space-y-3">
        {groups.map((group) => (
          <OverviewSoftPanel key={group.sector}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <RecommendationCardField label="Setor">
                <RecommendationCardText variant="highlight">{group.sector}</RecommendationCardText>
              </RecommendationCardField>
              <RecommendationCardText variant="meta">
                {countLabel(group.actions.length, "ação", "ações")}
              </RecommendationCardText>
            </div>
            <ul className="mt-4 space-y-2" aria-label={`Ações de ${group.sector}`}>
              {group.actions.map((action) => (
                <li
                  key={action.id}
                  className="flex items-start justify-between gap-3 border-t border-slate-200/70 pt-2"
                >
                  <p className="min-w-0 text-sm text-slate-800">
                    <span className="font-medium">{action.label}</span>
                    {" · "}
                    {action.text}
                  </p>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-600">
                    {action.progress}%
                  </span>
                </li>
              ))}
            </ul>
          </OverviewSoftPanel>
        ))}
      </div>
    </section>
  );
}
