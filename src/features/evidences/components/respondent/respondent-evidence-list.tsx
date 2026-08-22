"use client";

import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import { typography } from "@/shared/layout/design-system";
import { RespondentEvidenceCard } from "./respondent-evidence-card";

type Props = {
  items: RespondentEvidenceItem[];
  onOpenDetail: (item: RespondentEvidenceItem) => void;
  returnPath: string;
};

export function RespondentEvidenceList({ items, onOpenDetail, returnPath }: Props) {
  return (
    <section
      className="space-y-3"
      aria-labelledby="respondent-evidence-list-heading"
    >
      <h3
        id="respondent-evidence-list-heading"
        className={typography.subsectionTitle}
      >
        Histórico da listagem
      </h3>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <RespondentEvidenceCard
              item={item}
              onOpenDetail={onOpenDetail}
              returnPath={returnPath}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
