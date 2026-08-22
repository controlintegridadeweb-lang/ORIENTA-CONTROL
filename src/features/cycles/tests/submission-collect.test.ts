import { describe, expect, it } from "vitest";
import {
  evaluateSubmissionReadiness,
  type SubmissionQuestion,
} from "@/shared/domain/submission";

// Réplica fiel do que collectSubmissionQuestions produziria para o cenário do banco:
// Q1 respondido "no" (ok), Q2 "yes" exige evidência sem anexo
// (não conformidade diagnóstica, mas não bloqueia), Q3 não respondido (bloqueia).
const fromDb: SubmissionQuestion[] = [
  {
    questionId: "q1",
    appliesToRespondent: true,
    isNotApplicable: false,
    hasWaiver: false,
    famiEnabled: true,
    requiresEvidence: false,
    answer: "no",
    hasActiveEvidence: false,
  },
  {
    questionId: "q2",
    appliesToRespondent: true,
    isNotApplicable: false,
    hasWaiver: false,
    famiEnabled: true,
    requiresEvidence: true,
    answer: "yes",
    hasActiveEvidence: false,
  },
  {
    questionId: "q3",
    appliesToRespondent: true,
    isNotApplicable: false,
    hasWaiver: false,
    famiEnabled: true,
    requiresEvidence: false,
    answer: null,
    hasActiveEvidence: false,
  },
];

describe("cadeia coletor→predicado (cenário do banco real)", () => {
  it("bloqueia somente a pergunta sem resposta", () => {
    const r = evaluateSubmissionReadiness(fromDb);
    expect(r.ready).toBe(false);
    expect(r.blocks).toEqual([
      { questionId: "q3", reason: "unanswered" },
    ]);
  });

  it("após responder q3, fica pronto mesmo sem anexo em q2", () => {
    const fixed = fromDb.map((q) =>
      q.questionId === "q3"
        ? { ...q, answer: "no" as const }
        : q,
    );
    expect(evaluateSubmissionReadiness(fixed).ready).toBe(true);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { collectSubmissionSnapshots } from "../submission-collect";

function buildBatchCollectorClient() {
  const calls = new Map<string, number>();
  const tableData: Record<string, unknown[]> = {
    form_questions: [
      {
        form_version_id: "fv-1",
        question_version_id: "qv-1",
        question_versions: {
          question_id: "q-1",
          applies_to_respondent: true,
          fami_enabled: true,
          evidence_parameter: { mode: "required" },
        },
      },
    ],
    responses: [
      {
        id: "response-1",
        cycle_id: "cycle-1",
        question_version_id: "qv-1",
        answer: "yes",
        is_not_applicable: false,
        na_validation_status: null,
        updated_at: "2026-07-16T12:00:00.000Z",
      },
      {
        id: "response-2",
        cycle_id: "cycle-2",
        question_version_id: "qv-1",
        answer: "no",
        is_not_applicable: false,
        na_validation_status: null,
        updated_at: "2026-07-16T13:00:00.000Z",
      },
    ],
    evidences: [
      {
        id: "evidence-1",
        response_id: "response-1",
        validation_status: "approved",
        validated_at: "2026-07-16T14:00:00.000Z",
        submitted_at: "2026-07-16T12:30:00.000Z",
      },
    ],
    question_organization_waivers: [],
  };

  const client = {
    from(table: string) {
      calls.set(table, (calls.get(table) ?? 0) + 1);
      const builder = {
        select() {
          return builder;
        },
        in() {
          return builder;
        },
        is() {
          return builder;
        },
        then<TResult>(
          onFulfilled: (value: { data: unknown[]; error: null }) => TResult,
        ) {
          return Promise.resolve({
            data: tableData[table] ?? [],
            error: null,
          }).then(onFulfilled);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

describe("collectSubmissionSnapshots", () => {
  it("carrega vários ciclos sem repetir consultas por diagnóstico", async () => {
    const { client, calls } = buildBatchCollectorClient();
    const snapshots = await collectSubmissionSnapshots(client, [
      {
        cycleId: "cycle-1",
        formVersionId: "fv-1",
        organizationId: "org-1",
      },
      {
        cycleId: "cycle-2",
        formVersionId: "fv-1",
        organizationId: "org-1",
      },
    ]);

    expect(snapshots.get("cycle-1")?.questions[0]).toMatchObject({
      answer: "yes",
      hasActiveEvidence: true,
      validationStatus: "approved",
    });
    expect(snapshots.get("cycle-2")?.questions[0]).toMatchObject({
      answer: "no",
      hasActiveEvidence: false,
    });
    expect(Object.fromEntries(calls)).toEqual({
      form_questions: 1,
      responses: 1,
      question_organization_waivers: 1,
      evidences: 1,
    });
  });
});
