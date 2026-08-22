"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkbenchRow } from "./load-workbench-payload";

function groupRowsBySection(rows: WorkbenchRow[]) {
  const sections: { name: string; rows: WorkbenchRow[] }[] = [];
  const indexByName = new Map<string, number>();

  for (const row of rows) {
    const name = row.sectionName?.trim() || "Geral";
    let index = indexByName.get(name);

    if (index === undefined) {
      index = sections.length;
      indexByName.set(name, index);
      sections.push({ name, rows: [] });
    }

    sections[index].rows.push(row);
  }

  return sections;
}

function sectionIndexForQuestion(
  sections: ReturnType<typeof groupRowsBySection>,
  rows: WorkbenchRow[],
  questionId?: string,
): number {
  if (!questionId || rows.length === 0) return -1;

  const row = rows.find((item) => item.questionId === questionId);
  if (!row) return -1;

  const sectionName = row.sectionName?.trim() || "Geral";
  return sections.findIndex((section) => section.name === sectionName);
}

/**
 * Gerencia a navegação entre seções do workbench.
 *
 * `initialFocusQuestionId` restringe a interface à pergunta do deep link.
 * `preferredQuestionId` mantém o formulário completo, mas posiciona o usuário
 * na primeira correção pendente e acompanha a próxima pendência quando a atual
 * é resolvida.
 */
export function useWorkbenchNavigation({
  rows,
  initialFocusQuestionId,
  preferredQuestionId,
  scopeKey,
}: {
  rows: WorkbenchRow[];
  initialFocusQuestionId?: string;
  preferredQuestionId?: string;
  scopeKey?: string;
}) {
  const questionFocusMode = Boolean(initialFocusQuestionId);

  const displayRows = useMemo(() => {
    if (!initialFocusQuestionId || rows.length === 0) return rows;
    const focused = rows.filter((row) => row.questionId === initialFocusQuestionId);
    return focused.length > 0 ? focused : rows;
  }, [rows, initialFocusQuestionId]);

  const groupedBySection = useMemo(
    () => groupRowsBySection(displayRows),
    [displayRows],
  );

  const navigationQuestionId = initialFocusQuestionId ?? preferredQuestionId;
  const navigationSectionIndex = useMemo(
    () =>
      sectionIndexForQuestion(
        groupedBySection,
        displayRows,
        navigationQuestionId,
      ),
    [displayRows, groupedBySection, navigationQuestionId],
  );

  const [currentSectionIndex, setCurrentSectionIndex] = useState(() =>
    navigationSectionIndex >= 0 ? navigationSectionIndex : 0,
  );
  const [stepDirection, setStepDirection] = useState<"forward" | "back">(
    "forward",
  );
  const [advancingSection, setAdvancingSection] = useState(false);
  const [appliedNavigationQuestionId, setAppliedNavigationQuestionId] = useState<
    string | null
  >(() => (navigationSectionIndex >= 0 ? navigationQuestionId ?? null : null));
  const scrolledQuestionRef = useRef<string | null>(null);
  const appliedScopeKeyRef = useRef(scopeKey);

  useEffect(() => {
    if (appliedScopeKeyRef.current === scopeKey) return;
    appliedScopeKeyRef.current = scopeKey;
    setCurrentSectionIndex(navigationSectionIndex >= 0 ? navigationSectionIndex : 0);
    setStepDirection("forward");
    setAppliedNavigationQuestionId(
      navigationSectionIndex >= 0 ? navigationQuestionId ?? null : null,
    );
    scrolledQuestionRef.current = null;
  }, [navigationQuestionId, navigationSectionIndex, scopeKey]);

  /* eslint-disable react-hooks/set-state-in-effect -- Sincroniza a navegação local após a mudança da correção preferencial, sem atualizar estado durante a renderização. */
  useEffect(() => {
    if (
      !navigationQuestionId ||
      navigationSectionIndex < 0 ||
      appliedNavigationQuestionId === navigationQuestionId
    ) {
      return;
    }

    setAppliedNavigationQuestionId(navigationQuestionId);
    setStepDirection(
      navigationSectionIndex < currentSectionIndex ? "back" : "forward",
    );
    setCurrentSectionIndex(navigationSectionIndex);
  }, [
    appliedNavigationQuestionId,
    currentSectionIndex,
    navigationQuestionId,
    navigationSectionIndex,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!navigationQuestionId || navigationSectionIndex < 0) return;
    if (scrolledQuestionRef.current === navigationQuestionId) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`pergunta-${navigationQuestionId}`);
      if (!target) return;
      scrolledQuestionRef.current = navigationQuestionId;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentSectionIndex, navigationQuestionId, navigationSectionIndex]);

  const resetNavigation = useCallback(() => {
    setCurrentSectionIndex(0);
    setStepDirection("forward");
    setAppliedNavigationQuestionId(null);
    scrolledQuestionRef.current = null;
  }, []);

  return {
    currentSectionIndex,
    setCurrentSectionIndex,
    stepDirection,
    setStepDirection,
    advancingSection,
    setAdvancingSection,
    groupedBySection,
    questionFocusMode,
    resetNavigation,
  };
}
