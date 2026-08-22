import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sortAxesMaturity } from "./fami-axis-display";
import type { AxisMaturity } from "./types";

type FrozenFamiSection = {
  id: string;
  name: string;
  order: number;
  axisId: string;
};

type FrozenFamiAxis = {
  id: string;
  name: string;
};

export type FrozenFamiScopeCatalog = {
  sections: Map<string, FrozenFamiSection>;
  axes: Map<string, FrozenFamiAxis>;
};

export type FrozenAxisResultRow = {
  scopeId: string | null;
  percentage: number | null;
  maturityLevel: number | null;
};

/** Mapeia somente linhas FAMI realmente persistidas; nunca inventa eixos zerados. */
export function mapFrozenAxisMaturityRows(
  rows: FrozenAxisResultRow[],
  catalog: FrozenFamiScopeCatalog,
): AxisMaturity[] {
  return sortAxesMaturity(
    rows.flatMap((row) => {
      if (!row.scopeId) return [];
      return [{
        axisId: row.scopeId,
        axisName: catalog.axes.get(row.scopeId)?.name ?? "Eixo histórico sem identificação",
        percentage: Number(row.percentage ?? 0),
        maturityLevel: row.maturityLevel == null ? null : Number(row.maturityLevel),
      }];
    }),
  );
}

const questionVersionSchema = z.object({
  section_id: z.string().min(1),
  section_name: z.string(),
  section_order: z.coerce.number().int(),
  axis_id: z.string().min(1),
  axis_name: z.string(),
});

const formQuestionSchema = z.object({
  question_versions: z.union([questionVersionSchema, z.array(questionVersionSchema)]),
});

function firstQuestionVersion(
  value: z.infer<typeof formQuestionSchema>["question_versions"],
): z.infer<typeof questionVersionSchema> | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function assertSameSection(
  current: FrozenFamiSection,
  next: FrozenFamiSection,
): void {
  if (
    current.name !== next.name ||
    current.order !== next.order ||
    current.axisId !== next.axisId
  ) {
    throw new Error(`fami_historical_scope_conflict: seção ${next.id} possui snapshots divergentes.`);
  }
}

function assertSameAxis(current: FrozenFamiAxis, next: FrozenFamiAxis): void {
  if (current.name !== next.name) {
    throw new Error(`fami_historical_scope_conflict: eixo ${next.id} possui snapshots divergentes.`);
  }
}

/**
 * Catálogo de nomes e relações congelado na versão publicada do formulário.
 * Nunca consulta `sections` ou `axes`, pois essas tabelas são editáveis e não
 * podem alterar retroativamente a apresentação de um resultado FAMI oficial.
 */
export async function loadFrozenFamiScopeCatalog(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<FrozenFamiScopeCatalog> {
  const { data: cycle, error: cycleError } = await supabase
    .from("cycles")
    .select("form_version_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleError) throw cycleError;
  if (!cycle?.form_version_id) {
    throw new Error("fami_cycle_form_version_not_found");
  }

  const { data, error } = await supabase
    .from("form_questions")
    .select(
      "question_versions!inner(section_id, section_name, section_order, axis_id, axis_name)",
    )
    .eq("form_version_id", cycle.form_version_id as string);
  if (error) throw error;

  const sections = new Map<string, FrozenFamiSection>();
  const axes = new Map<string, FrozenFamiAxis>();

  for (const row of z.array(formQuestionSchema).parse(data ?? [])) {
    const questionVersion = firstQuestionVersion(row.question_versions);
    if (!questionVersion) continue;

    const section: FrozenFamiSection = {
      id: questionVersion.section_id,
      name: questionVersion.section_name,
      order: questionVersion.section_order,
      axisId: questionVersion.axis_id,
    };
    const axis: FrozenFamiAxis = {
      id: questionVersion.axis_id,
      name: questionVersion.axis_name,
    };

    const currentSection = sections.get(section.id);
    if (currentSection) assertSameSection(currentSection, section);
    else sections.set(section.id, section);

    const currentAxis = axes.get(axis.id);
    if (currentAxis) assertSameAxis(currentAxis, axis);
    else axes.set(axis.id, axis);
  }

  return { sections, axes };
}

function missingIds(expected: Iterable<string>, actual: Set<string>): string[] {
  return [...expected].filter((id) => !actual.has(id));
}

function unexpectedIds(actual: Set<string>, expected: Map<string, unknown>): string[] {
  return [...actual].filter((id) => !expected.has(id));
}

function namesForIds<T extends { name: string }>(ids: string[], catalog: Map<string, T>): string {
  return ids.map((id) => catalog.get(id)?.name || id).join(", ");
}

/** Mensagens explícitas para dados legados incompletos ou fora do escopo congelado. */
export function buildFamiScopeIntegrityWarnings(
  catalog: FrozenFamiScopeCatalog,
  storedAxisIds: Iterable<string>,
  storedSectionIds: Iterable<string>,
): string[] {
  const axes = new Set(storedAxisIds);
  const sections = new Set(storedSectionIds);
  const warnings: string[] = [];

  const missingAxes = missingIds(catalog.axes.keys(), axes);
  const extraAxes = unexpectedIds(axes, catalog.axes);
  const missingSections = missingIds(catalog.sections.keys(), sections);
  const extraSections = unexpectedIds(sections, catalog.sections);

  if (missingAxes.length) {
    warnings.push(`Resultado FAMI incompleto: faltam os eixos congelados ${namesForIds(missingAxes, catalog.axes)}.`);
  }
  if (extraAxes.length) {
    warnings.push(`Resultado FAMI inconsistente: há eixos fora da versão publicada (${extraAxes.join(", ")}).`);
  }
  if (missingSections.length) {
    warnings.push(`Resultado FAMI incompleto: faltam as seções congeladas ${namesForIds(missingSections, catalog.sections)}.`);
  }
  if (extraSections.length) {
    warnings.push(`Resultado FAMI inconsistente: há seções fora da versão publicada (${extraSections.join(", ")}).`);
  }

  return warnings;
}
