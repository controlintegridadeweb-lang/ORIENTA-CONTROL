import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

/**
 * Mock determinista do PostgrestClient para o `FormsAdminService` no modelo
 * canônico de RASCUNHO: tabelas `forms`, `form_drafts`, `form_draft_questions`,
 * `questions`, `question_versions`, `sections`. Implementa só o subconjunto de
 * operações que o service usa, para testar a lógica (ordenação, validações,
 * hard-delete de órfãs) sem o Supabase real.
 */
type FormRow = {
  id: string;
  name: string;
  current_form_version_id: string | null;
  created_at: string;
  created_by: string;
};
type DraftRow = { id: string; form_id: string; updated_at: string };
type DraftQuestionRow = {
  form_draft_id: string;
  question_id: string;
  order_index: number;
};
type QuestionRow = {
  id: string;
  prompt: string;
  section_id: string | null;
  evidence_parameter: unknown;
  allows_not_applicable: boolean;
  fami_enabled: boolean;
  applies_to_respondent: boolean;
};
type SectionRow = { id: string; name: string };
type QuestionVersionRow = { id: string; question_id: string };
type FormVersionRow = {
  id: string;
  version: number;
  state: "published" | "superseded" | "archived";
  published_at: string | null;
};

export type Db = {
  forms: FormRow[];
  form_drafts: DraftRow[];
  form_draft_questions: DraftQuestionRow[];
  questions: QuestionRow[];
  question_versions: QuestionVersionRow[];
  form_versions: FormVersionRow[];
  sections: SectionRow[];
};

let uuidCounter = 0;
export function genId(prefix = "00000000-0000-4000-8000-") {
  uuidCounter += 1;
  return prefix + uuidCounter.toString(16).padStart(12, "0");
}

export function buildMock(db: Db): TypedSupabaseClient {
  type Row = Record<string, unknown>;
  type Filter = { col: string; op: "eq" | "in" | "is"; val: unknown };

  function clone<T>(x: T): T {
    return JSON.parse(JSON.stringify(x)) as T;
  }
  function applyFilters(rows: Row[], filters: Filter[]): Row[] {
    return rows.filter((r) =>
      filters.every((f) => {
        if (f.op === "eq") return r[f.col] === f.val;
        if (f.op === "in") return (f.val as unknown[]).includes(r[f.col]);
        if (f.op === "is") return r[f.col] === f.val;
        return true;
      }),
    );
  }

  function makeBuilder(table: keyof Db) {
    const state: {
      op: "select" | "insert" | "update" | "delete";
      filters: Filter[];
      orderBy?: { col: string; asc: boolean };
      limitN?: number;
      single?: "single" | "maybe";
      payload?: Row | Row[];
      head?: boolean;
      wantCount?: boolean;
    } = { op: "select", filters: [] };

    const api = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.count) state.wantCount = true;
        if (opts?.head) state.head = true;
        return api;
      },
      insert(payload: Row | Row[]) {
        state.op = "insert";
        state.payload = payload;
        return api;
      },
      update(payload: Row) {
        state.op = "update";
        state.payload = payload;
        return api;
      },
      delete() {
        state.op = "delete";
        return api;
      },
      eq(col: string, val: unknown) {
        state.filters.push({ col, op: "eq", val });
        return api;
      },
      in(col: string, val: unknown[]) {
        state.filters.push({ col, op: "in", val });
        return api;
      },
      is(col: string, val: unknown) {
        state.filters.push({ col, op: "is", val });
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        state.orderBy = { col, asc: opts?.ascending !== false };
        return api;
      },
      limit(n: number) {
        state.limitN = n;
        return api;
      },
      single() {
        state.single = "single";
        return run();
      },
      maybeSingle() {
        state.single = "maybe";
        return run();
      },
      then<TResult>(
        onFulfilled: (value: {
          data: unknown;
          error: unknown;
          count?: number;
        }) => TResult,
      ) {
        return run().then(onFulfilled);
      },
    };

    function run() {
      return Promise.resolve().then(() => {
        const rows = db[table] as unknown as Row[];
        if (state.op === "insert") {
          const toInsert = Array.isArray(state.payload)
            ? (state.payload as Row[])
            : [state.payload as Row];
          const created = toInsert.map((p) => {
            const row: Row = { ...p };
            if (table === "forms") {
              row.id = row.id ?? genId();
              row.created_at = row.created_at ?? new Date().toISOString();
              row.current_form_version_id = row.current_form_version_id ?? null;
            }
            if (table === "form_drafts") {
              row.id = row.id ?? genId();
              row.updated_at = new Date().toISOString();
            }
            if (table === "questions") row.id = row.id ?? genId();
            return row;
          });
          rows.push(...created);
          const data = state.single ? created[0] : created;
          return { data: clone(data), error: null, count: created.length };
        }
        if (state.op === "update") {
          const matched = applyFilters(rows, state.filters);
          for (const row of matched) Object.assign(row, state.payload as Row);
          const data = state.single ? (matched[0] ?? null) : matched;
          return { data: clone(data), error: null, count: matched.length };
        }
        if (state.op === "delete") {
          const keep: Row[] = [];
          const removed: Row[] = [];
          for (const r of rows) {
            if (applyFilters([r], state.filters).length > 0) removed.push(r);
            else keep.push(r);
          }
          (db[table] as unknown as Row[]).length = 0;
          (db[table] as unknown as Row[]).push(...keep);
          return { data: clone(removed), error: null, count: removed.length };
        }
        let result = applyFilters(rows, state.filters);
        if (state.orderBy) {
          const { col, asc } = state.orderBy;
          result = [...result].sort((a, b) => {
            const av = a[col];
            const bv = b[col];
            if (av === bv) return 0;
            const cmp = av! > bv! ? 1 : -1;
            return asc ? cmp : -cmp;
          });
        }
        if (state.limitN !== undefined) result = result.slice(0, state.limitN);
        if (state.head)
          return { data: null, error: null, count: result.length };
        if (state.single === "single") {
          return result.length > 0
            ? { data: clone(result[0]), error: null }
            : { data: null, error: { message: "not found" } };
        }
        if (state.single === "maybe") {
          return {
            data: result.length > 0 ? clone(result[0]) : null,
            error: null,
          };
        }
        return { data: clone(result), error: null, count: result.length };
      });
    }
    return api;
  }

  return {
    from: (t: string) => makeBuilder(t as keyof Db),
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "list_forms_page") {
        const limit = Number(args.p_limit ?? 25);
        const offset = Number(args.p_offset ?? 0);
        const rows = [...db.forms]
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(offset, offset + limit)
          .map((form) => {
            const draft = db.form_drafts.find((row) => row.form_id === form.id);
            const version = form.current_form_version_id
              ? db.form_versions.find((row) => row.id === form.current_form_version_id)
              : null;
            return {
              id: form.id,
              name: form.name,
              version: version?.version ?? null,
              publication_state: version?.state ?? "draft",
              created_at: form.created_at,
              question_count: draft
                ? db.form_draft_questions.filter(
                    (row) => row.form_draft_id === draft.id,
                  ).length
                : 0,
              published_at: version?.published_at ?? null,
              total_count: db.forms.length,
            };
          });
        return Promise.resolve({ data: clone(rows), error: null });
      }

      if (name === "create_form_draft_question") {
        const formId = String(args.p_form_id);
        const draft = db.form_drafts.find((row) => row.form_id === formId);
        if (!draft) {
          return Promise.resolve({
            data: null,
            error: { message: "form_draft_not_found" },
          });
        }
        const orderIndex =
          db.form_draft_questions
            .filter((row) => row.form_draft_id === draft.id)
            .reduce((max, row) => Math.max(max, row.order_index), -1) + 1;
        const question: QuestionRow = {
          id: genId(),
          prompt: String(args.p_prompt),
          section_id: String(args.p_section_id),
          evidence_parameter: clone(args.p_evidence_parameter),
          allows_not_applicable: false,
          fami_enabled: true,
          applies_to_respondent: true,
        };
        db.questions.push(question);
        db.form_draft_questions.push({
          form_draft_id: draft.id,
          question_id: question.id,
          order_index: orderIndex,
        });
        return Promise.resolve({
          data: clone({
            id: question.id,
            section_id: question.section_id,
            prompt: question.prompt,
            evidence_parameter: question.evidence_parameter,
            allows_not_applicable: question.allows_not_applicable,
            order_index: orderIndex,
          }),
          error: null,
        });
      }

      if (name === "remove_form_draft_question") {
        const formId = String(args.p_form_id);
        const questionId = String(args.p_question_id);
        const draft = db.form_drafts.find((row) => row.form_id === formId);
        const linkIndex = draft
          ? db.form_draft_questions.findIndex(
              (row) =>
                row.form_draft_id === draft.id &&
                row.question_id === questionId,
            )
          : -1;
        if (linkIndex < 0) {
          return Promise.resolve({
            data: null,
            error: { message: "form_question_not_found" },
          });
        }
        db.form_draft_questions.splice(linkIndex, 1);
        db.form_draft_questions
          .filter((row) => row.form_draft_id === draft!.id)
          .sort((a, b) => a.order_index - b.order_index)
          .forEach((row, index) => {
            row.order_index = index;
          });
        const materialized = db.question_versions.some(
          (row) => row.question_id === questionId,
        );
        const stillLinked = db.form_draft_questions.some(
          (row) => row.question_id === questionId,
        );
        if (!materialized && !stillLinked) {
          db.questions = db.questions.filter((row) => row.id !== questionId);
        }
        return Promise.resolve({ data: null, error: null });
      }

      if (name === "delete_unpublished_form") {
        const formId = String(args.p_form_id);
        const form = db.forms.find((row) => row.id === formId);
        if (!form) {
          return Promise.resolve({
            data: null,
            error: { message: "form_not_found" },
          });
        }
        if (form.current_form_version_id) {
          return Promise.resolve({
            data: null,
            error: { message: "published_form_cannot_be_deleted" },
          });
        }
        const draftIds = db.form_drafts
          .filter((row) => row.form_id === formId)
          .map((row) => row.id);
        const questionIds = db.form_draft_questions
          .filter((row) => draftIds.includes(row.form_draft_id))
          .map((row) => row.question_id);
        db.form_draft_questions = db.form_draft_questions.filter(
          (row) => !draftIds.includes(row.form_draft_id),
        );
        db.form_drafts = db.form_drafts.filter((row) => row.form_id !== formId);
        db.forms = db.forms.filter((row) => row.id !== formId);
        db.questions = db.questions.filter(
          (row) =>
            !questionIds.includes(row.id) ||
            db.question_versions.some(
              (version) => version.question_id === row.id,
            ) ||
            db.form_draft_questions.some((link) => link.question_id === row.id),
        );
        return Promise.resolve({ data: null, error: null });
      }

      if (name === "reorder_form_draft_questions") {
        const draftId = String(args.p_form_draft_id);
        const orderedQuestionIds = args.p_ordered_question_ids as string[];
        const draftRows = db.form_draft_questions.filter(
          (row) => row.form_draft_id === draftId,
        );
        const currentIds = new Set(draftRows.map((row) => row.question_id));
        const valid =
          orderedQuestionIds.length === currentIds.size &&
          new Set(orderedQuestionIds).size === currentIds.size &&
          orderedQuestionIds.every((id) => currentIds.has(id));
        if (!valid) {
          return Promise.resolve({
            data: null,
            error: { message: "form_draft_question_order_mismatch" },
          });
        }

        orderedQuestionIds.forEach((questionId, orderIndex) => {
          const row = draftRows.find((item) => item.question_id === questionId);
          if (row) row.order_index = orderIndex;
        });
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve({
        data: null,
        error: { message: `rpc_not_implemented:${name}` },
      });
    },
  } as unknown as TypedSupabaseClient;
}

export const SECTION_ID = "00000000-0000-4000-9000-0000000000aa";

export function emptyDb(): Db {
  return {
    forms: [],
    form_drafts: [],
    form_draft_questions: [],
    questions: [],
    question_versions: [],
    form_versions: [],
    sections: [{ id: SECTION_ID, name: "Governança · Geral" }],
  };
}

export function seedForm(db: Db, overrides: Partial<FormRow> = {}): FormRow {
  const row: FormRow = {
    id: genId(),
    name: overrides.name ?? "Form",
    current_form_version_id: overrides.current_form_version_id ?? null,
    created_at: overrides.created_at ?? new Date().toISOString(),
    created_by: overrides.created_by ?? "user-1",
  };
  db.forms.push(row);
  return row;
}

export const Q = (prompt: string, requiresEvidence = false) => ({
  prompt,
  sectionId: SECTION_ID,
  requiresEvidence,
});
export const ACTOR = { userId: "user-1" };


export function resetAdminServiceFixture() {
  uuidCounter = 0;
}
