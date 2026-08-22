import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { listCycles, type CycleListItem } from "@/features/cycles/cycle-queries";
import { selectLatestCyclePerOrganization } from "@/features/cycles/dashboard-model";
import {
  countFormApplicationOrganizations,
  deriveFormApplicationStatus,
  FORM_APPLICATION_STATUS_LABEL,
  hasIndividualDeadlineExceptions,
  isEditableResponseState,
  isExceptionalDeadline,
  isResponseDeadlineOverdueAt,
  listFormAdminActions,
  resolveGlobalDeadline,
  type FormManagementCycleInput,
} from "./domain";
import type {
  FormManagementCriterionOption,
  FormManagementDetails,
  FormManagementHistoryItem,
  FormManagementOrganizationRow,
} from "./types";

function toDomainCycle(cycle: CycleListItem): FormManagementCycleInput {
  return {
    id: cycle.id,
    organizationId: cycle.organizationId,
    state: cycle.state,
    responseDeadlineAt: cycle.responseDeadlineAt,
    originalResponseDeadlineAt: cycle.originalResponseDeadlineAt,
    responseCollectionPausedAt: cycle.responseCollectionPausedAt,
    deadlineChangeCount: cycle.deadlineChangeCount,
    reopenCount: cycle.reopenCount,
    startsAt: cycle.startsAt,
    closedAt: cycle.closedAt,
  };
}

function deadlineStatusFor(
  cycle: FormManagementCycleInput,
  now: Date,
): FormManagementOrganizationRow["deadlineStatus"] {
  if (cycle.responseCollectionPausedAt) return "paused";
  if (!cycle.responseDeadlineAt) return "none";
  if (!isEditableResponseState(cycle.state)) return "closed";
  if (
    isResponseDeadlineOverdueAt(
      cycle.responseDeadlineAt,
      cycle.state,
      now,
      cycle.responseCollectionPausedAt,
    )
  ) {
    return "overdue";
  }
  return "on_time";
}

const historyRowSchema = z.object({
  id: z.string().min(1),
  batch_id: z.string().min(1),
  action: z.string(),
  scope: z.string(),
  previous_deadline_at: z.string().nullable(),
  new_deadline_at: z.string().nullable(),
  justification: z.string(),
  actor_user_id: z.string().min(1),
  organization_id: z.string().min(1),
  created_at: z.string(),
  organizations: z.object({ name: z.string() }).nullable().optional(),
  profiles: z.object({ full_name: z.string().nullable() }).nullable().optional(),
});

export async function loadFormManagementDetails(
  supabase: SupabaseClient,
  input: { formId: string; periodLabel?: string | null },
  now: Date = new Date(),
): Promise<FormManagementDetails | null> {
  const formId = input.formId.trim();
  if (!formId) return null;

  const { data: formRow, error: formError } = await supabase
    .from("forms")
    .select("id, name, created_by, current_form_version_id")
    .eq("id", formId)
    .maybeSingle();
  if (formError) throw formError;
  if (!formRow) return null;

  let formVersion: { id: string; version: number; published_at: string | null } | null = null;
  if (formRow.current_form_version_id) {
    const { data: versionRow, error: versionError } = await supabase
      .from("form_versions")
      .select("id, version, published_at")
      .eq("id", formRow.current_form_version_id)
      .maybeSingle();
    if (versionError) throw versionError;
    formVersion = versionRow
      ? z
          .object({
            id: z.string().min(1),
            version: z.number().int(),
            published_at: z.string().nullable(),
          })
          .parse(versionRow)
      : null;
  }

  const { data: creatorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", formRow.created_by)
    .maybeSingle();

  let cycles = selectLatestCyclePerOrganization(
    await listCycles(supabase, {
      formId,
      ...(input.periodLabel ? { periodLabel: input.periodLabel } : {}),
    }),
  );

  if (!input.periodLabel && cycles.length > 0) {
    const periods = [...new Set(cycles.map((cycle) => cycle.periodLabel))].sort((a, b) =>
      b.localeCompare(a, "pt-BR"),
    );
    const latestPeriod = periods[0];
    if (latestPeriod) {
      cycles = cycles.filter((cycle) => cycle.periodLabel === latestPeriod);
    }
  }

  const periodLabel =
    input.periodLabel?.trim() ||
    cycles[0]?.periodLabel ||
    "";

  const domainCycles = cycles.map(toDomainCycle);
  const status = deriveFormApplicationStatus(domainCycles);
  const counts = countFormApplicationOrganizations(domainCycles, now);
  const globalDeadline = resolveGlobalDeadline(domainCycles);
  const currentDeadlines = domainCycles
    .map((cycle) => cycle.responseDeadlineAt)
    .filter((value): value is string => Boolean(value));
  const currentGlobal =
    currentDeadlines.length === 0
      ? null
      : [...currentDeadlines].sort(
          (a, b) => currentDeadlines.filter((x) => x === b).length - currentDeadlines.filter((x) => x === a).length,
        )[0] ?? null;

  const openedAt = domainCycles
    .map((cycle) => cycle.startsAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;

  // Encerramento efetivo (todos concluídos) ou data programada de encerramento automático.
  const closedAt = domainCycles.every((cycle) => cycle.state === "completed")
    ? domainCycles
        .map((cycle) => cycle.closedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null
    : (() => {
        const counts = new Map<string, number>();
        for (const cycle of cycles) {
          if (!cycle.cycleCloseAt) continue;
          counts.set(cycle.cycleCloseAt, (counts.get(cycle.cycleCloseAt) ?? 0) + 1);
        }
        let best: string | null = null;
        let bestCount = 0;
        for (const [value, count] of counts) {
          if (count > bestCount) {
            best = value;
            bestCount = count;
          }
        }
        return best;
      })();

  const organizations: FormManagementOrganizationRow[] = cycles
    .map((cycle) => {
      const domain = toDomainCycle(cycle);
      return {
        cycleId: cycle.id,
        organizationId: cycle.organizationId,
        organizationName: cycle.organizationName,
        organizationAcronym: cycle.organizationAcronym,
        state: cycle.state,
        applicableDeadlineAt: cycle.responseDeadlineAt,
        originalDeadlineAt: cycle.originalResponseDeadlineAt,
        deadlineStatus: deadlineStatusFor(domain, now),
        deadlineChangeCount: cycle.deadlineChangeCount,
        exceptionalDeadline: isExceptionalDeadline(domain),
        reopenCount: cycle.reopenCount,
      };
    })
    .sort((a, b) => a.organizationName.localeCompare(b.organizationName, "pt-BR"));

  let history: FormManagementHistoryItem[] = [];
  if (periodLabel) {
    const { data: historyData, error: historyError } = await supabase
      .from("cycle_deadline_events")
      .select(
        "id, batch_id, action, scope, previous_deadline_at, new_deadline_at, " +
          "justification, actor_user_id, organization_id, created_at, " +
          "organizations(name)",
      )
      .eq("form_id", formId)
      .eq("period_label", periodLabel)
      .order("created_at", { ascending: false })
      .limit(100);
    if (historyError) throw historyError;

    const rows = z.array(historyRowSchema.omit({ profiles: true })).parse(historyData ?? []);
    const actorIds = [...new Set(rows.map((row) => row.actor_user_id))];
    const actorNames = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const { data: actors, error: actorsError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", actorIds);
      if (actorsError) throw actorsError;
      for (const actor of actors ?? []) {
        actorNames.set(actor.user_id, actor.full_name);
      }
    }

    history = rows.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      action: row.action,
      scope: row.scope,
      previousDeadlineAt: row.previous_deadline_at,
      newDeadlineAt: row.new_deadline_at,
      justification: row.justification,
      actorUserId: row.actor_user_id,
      actorName: actorNames.get(row.actor_user_id) ?? null,
      organizationId: row.organization_id,
      organizationName: row.organizations?.name ?? "—",
      createdAt: row.created_at,
    }));
  }

  const formVersionId = formVersion?.id ?? cycles[0]?.formVersionId ?? "";
  let criteria: FormManagementCriterionOption[] = [];
  if (formVersionId) {
    const { data: questionRows, error: questionError } = await supabase
      .from("form_questions")
      .select(
        "order_index, question_version_id, " +
          "question_versions!inner(question_id, prompt, axis_name, section_name, applies_to_respondent)",
      )
      .eq("form_version_id", formVersionId)
      .order("order_index", { ascending: true });
    if (questionError) throw questionError;
    criteria = z
      .array(
        z.object({
          order_index: z.number().int(),
          question_version_id: z.string().min(1),
          question_versions: z.object({
            question_id: z.string().min(1),
            prompt: z.string(),
            axis_name: z.string().nullable(),
            section_name: z.string().nullable(),
            applies_to_respondent: z.boolean(),
          }),
        }),
      )
      .parse(questionRows ?? [])
      .filter((row) => row.question_versions.applies_to_respondent)
      .map((row) => ({
        questionVersionId: row.question_version_id,
        questionId: row.question_versions.question_id,
        prompt: row.question_versions.prompt,
        axisName: row.question_versions.axis_name ?? "—",
        sectionName: row.question_versions.section_name ?? "—",
        orderIndex: row.order_index,
      }));
  }

  return {
    formId,
    formName: formRow.name,
    formVersion: formVersion?.version ?? cycles[0]?.formVersion ?? 0,
    formVersionId,
    periodLabel,
    status,
    statusLabel: FORM_APPLICATION_STATUS_LABEL[status],
    publishedAt: formVersion?.published_at ?? null,
    openedAt,
    originalDeadlineAt: globalDeadline,
    currentGlobalDeadlineAt: currentGlobal,
    closedAt,
    createdByName: creatorProfile?.full_name ?? null,
    deadlineMode: hasIndividualDeadlineExceptions(domainCycles) ? "mixed" : "global",
    counts,
    actions: listFormAdminActions({ status, counts, cycles: domainCycles, now }),
    organizations,
    criteria,
    history,
  };
}
