import { beforeEach, describe, expect, it } from "vitest";
import {
  FormsAdminService,
  FormsConflictError,
  FormsValidationError,
} from "../admin-service";
import {
  ACTOR,
  Q,
  SECTION_ID,
  buildMock,
  emptyDb,
  genId,
  resetAdminServiceFixture,
  seedForm,
} from "./admin-service-fixture";

describe("FormsAdminService", () => {
  beforeEach(() => {
    resetAdminServiceFixture();
  });

  it("lista formulários e contagens de rascunho em consultas agrupadas", async () => {
    const db = emptyDb();
    const first = seedForm(db, { name: "Primeiro" });
    const second = seedForm(db, { name: "Segundo" });
    const svc = new FormsAdminService(buildMock(db));

    await svc.createQuestion(first.id, Q("A"), ACTOR);
    await svc.createQuestion(first.id, Q("B"), ACTOR);
    await svc.createQuestion(second.id, Q("C"), ACTOR);

    const list = await svc.list();
    expect(list).toHaveLength(2);
    expect(list.find((form) => form.id === first.id)?.questionCount).toBe(2);
    expect(list.find((form) => form.id === second.id)?.questionCount).toBe(1);
  });

  it("cria criterios no rascunho com order_index incremental (0, 1, 2)", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));

    const q1 = await svc.createQuestion(form.id, Q("Pergunta 1"), ACTOR);
    const q2 = await svc.createQuestion(form.id, Q("Pergunta 2", true), ACTOR);
    const q3 = await svc.createQuestion(form.id, Q("Pergunta 3"), ACTOR);

    expect([q1.orderIndex, q2.orderIndex, q3.orderIndex]).toEqual([0, 1, 2]);

    const list = await svc.listQuestions(form.id);
    expect(list.map((q) => q.prompt)).toEqual([
      "Pergunta 1",
      "Pergunta 2",
      "Pergunta 3",
    ]);
    // grava section_id (NOT NULL) e deriva requiresEvidence de evidence_parameter.
    expect(db.questions.every((q) => q.section_id === SECTION_ID)).toBe(true);
    expect(list[1].requiresEvidence).toBe(true);
    expect(list.every((q) => q.allowsNotApplicable === false)).toBe(true);
  });

  it("persiste allowsNotApplicable no cadastro e na atualização do critério", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));

    const created = await svc.createQuestion(
      form.id,
      {
        prompt: "Critério elegível a N/A admin",
        sectionId: SECTION_ID,
        requiresEvidence: true,
        allowsNotApplicable: true,
      },
      ACTOR,
    );
    expect(created.allowsNotApplicable).toBe(true);
    expect(
      db.questions.find((q) => q.id === created.id)?.allows_not_applicable,
    ).toBe(true);

    const updated = await svc.updateQuestion(form.id, created.id, {
      allowsNotApplicable: false,
    });
    expect(updated.allowsNotApplicable).toBe(false);
    expect(
      db.questions.find((q) => q.id === created.id)?.allows_not_applicable,
    ).toBe(false);
  });

  it("rejeita criar criterio com secao inexistente", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));
    await expect(
      svc.createQuestion(
        form.id,
        {
          prompt: "X",
          sectionId: "00000000-0000-4000-9000-0000000000ff",
          requiresEvidence: false,
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(FormsValidationError);
  });

  it("reorder troca a ordem ao passar array permutado", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));

    const q1 = await svc.createQuestion(form.id, Q("A"), ACTOR);
    const q2 = await svc.createQuestion(form.id, Q("B"), ACTOR);
    const q3 = await svc.createQuestion(form.id, Q("C"), ACTOR);

    const reordered = await svc.reorderQuestions(form.id, {
      orderedQuestionIds: [q3.id, q1.id, q2.id],
    });
    expect(reordered.map((q) => q.id)).toEqual([q3.id, q1.id, q2.id]);
    expect(reordered.map((q) => q.orderIndex)).toEqual([0, 1, 2]);
  });

  it("reorder rejeita array que nao cobre o conjunto atual", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));
    const q1 = await svc.createQuestion(form.id, Q("A"), ACTOR);
    await svc.createQuestion(form.id, Q("B"), ACTOR);

    await expect(
      svc.reorderQuestions(form.id, { orderedQuestionIds: [q1.id] }),
    ).rejects.toBeInstanceOf(FormsValidationError);
  });

  it("permite editar o rascunho mesmo de formulario ja publicado", async () => {
    // No modelo canônico a edição é sempre no rascunho — publicar não congela a
    // edição da próxima versão.
    const db = emptyDb();
    const form = seedForm(db, { current_form_version_id: genId() });
    const svc = new FormsAdminService(buildMock(db));
    const q = await svc.createQuestion(form.id, Q("Editável"), ACTOR);
    expect(q.prompt).toBe("Editável");
  });

  it("remove criterio do rascunho faz hard-delete de pergunta orfa", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));
    const q = await svc.createQuestion(form.id, Q("Unica"), ACTOR);

    await svc.removeQuestion(form.id, q.id, ACTOR);

    expect(
      db.form_draft_questions.find((x) => x.question_id === q.id),
    ).toBeUndefined();
    expect(db.questions.find((x) => x.id === q.id)).toBeUndefined();
  });

  it("remove criterio preserva pergunta materializada em versao publicada", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));
    const q = await svc.createQuestion(form.id, Q("Publicada"), ACTOR);
    // simula materialização em uma versão (question_versions)
    db.question_versions.push({ id: genId(), question_id: q.id });

    await svc.removeQuestion(form.id, q.id, ACTOR);

    expect(
      db.form_draft_questions.find((x) => x.question_id === q.id),
    ).toBeUndefined();
    expect(db.questions.find((x) => x.id === q.id)).toBeDefined();
  });

  it("deleteForm bloqueia formulario ja publicado", async () => {
    const db = emptyDb();
    const form = seedForm(db, { current_form_version_id: genId() });
    const svc = new FormsAdminService(buildMock(db));
    await expect(svc.deleteForm(form.id, ACTOR)).rejects.toBeInstanceOf(
      FormsConflictError,
    );
  });

  it("deleteForm remove form e perguntas orfas (nunca publicado)", async () => {
    const db = emptyDb();
    const form = seedForm(db);
    const svc = new FormsAdminService(buildMock(db));
    const q = await svc.createQuestion(form.id, Q("Uma"), ACTOR);

    await svc.deleteForm(form.id, ACTOR);
    expect(db.forms.find((x) => x.id === form.id)).toBeUndefined();
    expect(db.questions.find((x) => x.id === q.id)).toBeUndefined();
  });
});
