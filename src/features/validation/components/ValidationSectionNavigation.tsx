"use client";

import { useMemo } from "react";
import {
  ALL_AXES_PARAM,
  ALL_SECTIONS_PARAM,
  axisPendingCount,
  formSectionsCoverageCaption,
  groupSectionsByAxis,
  resolveSelectedAxisId,
  sectionSelectorStatusSuffix,
  sectionsForAxis,
  type QueueSectionNavGroup,
  type QueueSectionSummary,
} from "@/features/validation/queue-model";
import { formSurface } from "@/shared/layout/form-surface";

/** Selects de eixo/seção no mesmo padrão visual dos filtros da fila. */
export function ValidationSectionNavigation({
  groups: groupsProp,
  sections,
  totalPending,
  selectedAxisId: selectedAxisIdProp,
  selectedSectionId,
  onSelectAxis,
  onSelect,
  coverageCaption,
  compact = false,
}: {
  groups?: QueueSectionNavGroup[];
  sections: QueueSectionSummary[];
  totalPending: number;
  totalCount: number;
  selectedAxisId?: string | null;
  selectedSectionId: string;
  onSelectAxis?: (axisId: string | null) => void;
  onSelect: (sectionId: string) => void;
  coverageCaption?: string | null;
  /** Quando true, devolve só os campos (para embutir na barra de filtros). */
  compact?: boolean;
}) {
  const withoutTabItems = sections.filter((section) => section.totalCount === 0)
    .length;
  const caption =
    coverageCaption ??
    formSectionsCoverageCaption(sections.length, withoutTabItems);
  const groups = useMemo(
    () =>
      groupsProp && groupsProp.length > 0
        ? groupsProp
        : groupSectionsByAxis(sections),
    [groupsProp, sections],
  );

  const selectedAxisId = resolveSelectedAxisId(
    selectedAxisIdProp ?? ALL_AXES_PARAM,
    groups,
  );

  const visibleSections = useMemo(
    () => sectionsForAxis(sections, selectedAxisId),
    [sections, selectedAxisId],
  );

  const visibleGroups = useMemo(() => {
    if (selectedAxisId === ALL_AXES_PARAM) return groups;
    return groups.filter((group) => group.axisId === selectedAxisId);
  }, [groups, selectedAxisId]);

  function handleAxisChange(value: string) {
    if (!onSelectAxis) return;
    onSelectAxis(value === ALL_AXES_PARAM ? null : value);
  }

  const fieldClassName = compact
    ? `${formSurface.fieldGroup} min-w-0 text-sm`
    : `${formSurface.fieldGroup} min-w-0 text-sm sm:max-w-xs`;

  const fields = (
    <>
      <label className={fieldClassName} htmlFor="validation-axis">
        <span className={formSurface.label}>Eixo</span>
        <select
          id="validation-axis"
          className={formSurface.inputSelect}
          value={selectedAxisId}
          onChange={(event) => handleAxisChange(event.target.value)}
        >
          <option value={ALL_AXES_PARAM}>
            Todos os eixos
            {totalPending > 0 ? ` — ${totalPending} pendente(s)` : ""}
          </option>
          {groups.map((group) => {
            const pending = axisPendingCount(group);
            return (
              <option key={group.axisId} value={group.axisId}>
                {group.axisName}
                {pending > 0 ? ` — ${pending} pendente(s)` : " — concluído"}
              </option>
            );
          })}
        </select>
      </label>

      <label className={fieldClassName} htmlFor="validation-section">
        <span className={formSurface.label}>Seção</span>
        <select
          id="validation-section"
          className={formSurface.inputSelect}
          value={selectedSectionId}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value={ALL_SECTIONS_PARAM}>
            Todas as seções
            {sectionSelectorStatusSuffix(
              visibleSections.reduce(
                (total, section) => total + section.pendingCount,
                0,
              ),
              visibleSections.reduce(
                (total, section) => total + section.totalCount,
                0,
              ),
            )}
          </option>
          {selectedAxisId === ALL_AXES_PARAM
            ? visibleGroups.map((group) => (
                <optgroup key={group.axisId} label={group.axisName}>
                  {group.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                      {sectionSelectorStatusSuffix(
                        section.pendingCount,
                        section.totalCount,
                      )}
                    </option>
                  ))}
                </optgroup>
              ))
            : visibleSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                  {sectionSelectorStatusSuffix(
                    section.pendingCount,
                    section.totalCount,
                  )}
                </option>
              ))}
        </select>
      </label>
    </>
  );

  if (compact) {
    return fields;
  }

  return (
    <nav aria-label="Eixos e seções do formulário" className="space-y-1.5">
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        {fields}
      </div>
      {caption ? (
        <p className="text-xs text-slate-500" data-testid="section-coverage">
          {caption}
        </p>
      ) : null}
    </nav>
  );
}
