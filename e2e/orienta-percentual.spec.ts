import { expect, test, type Page } from "@playwright/test";
import { E2E_RUN_ID, journeyFormName, journeyPeriodLabel } from "./fixtures/execution-id";
import { loginAs, logout } from "./fixtures/orienta";
import {
  adminCreatesFormAndOpensCycle,
  adminRequestsAdjustment,
  createCanonicalJourneyState,
  respondentCorrectsAndAdminCloses,
  respondentSubmitsDiagnostic,
} from "./support/canonical-flow-steps";

const ACTION_TEXT = `E2E percentual ${E2E_RUN_ID}`;

test.describe.serial("acompanhamento percentual em ciclo validado", () => {
  test.describe.configure({ timeout: 180_000 });
  const state = createCanonicalJourneyState();
  state.formName = journeyFormName(E2E_RUN_ID, "percentual");
  state.periodLabel = journeyPeriodLabel(E2E_RUN_ID, "percentual");
  state.stopBeforeActionCompletion = true;

  test("abre um diagnóstico próprio, separado da jornada reaberta", async ({ page }) => {
    await adminCreatesFormAndOpensCycle(page, state);
  });

  test("respondente envia o diagnóstico do percentual", async ({ page }) => {
    await respondentSubmitsDiagnostic(page, state);
  });

  test("admin solicita ajuste no diagnóstico do percentual", async ({ page }) => {
    await adminRequestsAdjustment(page, state);
  });

  test("validação deixa o ciclo apto ao plano sem encerrar a avaliação", async ({ page }) => {
    await respondentCorrectsAndAdminCloses(page, state);
    expect(state.recommendationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("registra 40%, avança para 55% e recusa redução e outro órgão", async ({ page, request }) => {
    await loginAs(page, "respondent");
    await page.goto(`/respondente/plano-acao/${state.recommendationId}/acoes`);
    await page.getByRole("button", { name: "Nova ação" }).click();
    await page.getByLabel("Ação ou compromisso").fill(ACTION_TEXT);
    await page.getByLabel("Área responsável").fill("Unidade de Integridade");
    const responsible = page.getByLabel("Respondente responsável");
    await expect(responsible).toBeEnabled();
    await responsible.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Cadastrar ação" }).click();
    await expect(page.getByText(ACTION_TEXT)).toBeVisible();

    const first = await saveProgress(page, "40", "Acompanhamento inicial de 40% na homologação.");
    await expect(row(page).getByText("Em andamento", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Opções da ação ${ACTION_TEXT}` }).click();
    await page.getByRole("menuitem", { name: "Andamento" }).click();
    const progress = page.getByLabel("Progresso da ação");
    await progress.fill("10");
    await expect(progress).toHaveValue("40");
    await expect(
      page.getByText("O andamento só avança. O percentual atual (40%) é o mínimo desta atualização."),
    ).toBeVisible();
    const second = await saveProgress(page, "55", "Acompanhamento avançou para 55% na homologação.");
    await expect(row(page).getByText("Em andamento", { exact: true })).toBeVisible();
    await page.reload();
    await expect(row(page).getByText("Em andamento", { exact: true })).toBeVisible();

    const history = await page.evaluate(async (planId) => {
      const response = await fetch(
        `/api/respondent/action-plans/${planId}/progress-updates`,
        { credentials: "include" },
      );
      return { status: response.status, body: await response.json() };
    }, first.planId);
    expect(history.status).toBe(200);
    const percentages = (history.body.items ?? []).map(
      (item: { newPercentage?: number }) => item.newPercentage,
    );
    expect(percentages).toEqual(expect.arrayContaining([40, 55]));

    await page.goto("/respondente/portfolio-recomendacoes?view=action-plan");
    const portfolioCard = page.getByRole("region", { name: "Governanca" }).filter({
      has: page.getByText(state.formName ?? ""),
    });
    await expect(portfolioCard.getByText("55%", { exact: true })).toBeVisible();

    const decrease = await page.evaluate(
      async ({ planId, recommendationId, revision }) => {
        const response = await fetch("/api/respondent/action-plans", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "update_progress",
            planId,
            recommendationId,
            expectedRevision: revision,
            progressPercentage: 40,
            progressUpdateDescription: "Tentativa de reduzir o percentual.",
          }),
        });
        return response.status;
      },
      {
        planId: first.planId,
        recommendationId: state.recommendationId,
        revision: second.revision,
      },
    );
    expect(decrease).not.toBe(200);

    await logout(page);
    await loginAs(page, "outsider");
    const outsider = await page.evaluate(
      async ({ planId, recommendationId }) => {
        const response = await fetch("/api/respondent/action-plans", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "update_progress",
            planId,
            recommendationId,
            expectedRevision: 1,
            progressPercentage: 80,
            progressUpdateDescription: "Tentativa de outro órgão.",
          }),
        });
        return response.status;
      },
      { planId: first.planId, recommendationId: state.recommendationId },
    );
    expect([403, 404]).toContain(outsider);

    const anonymous = await request.post("/api/respondent/action-plans", {
      headers: { Origin: "http://127.0.0.1:3003" },
      data: {
        intent: "update_progress",
        planId: first.planId,
        recommendationId: state.recommendationId,
        expectedRevision: 1,
        progressPercentage: 80,
        progressUpdateDescription: "Tentativa sem sessão.",
      },
    });
    expect(anonymous.status()).toBe(401);
  });
});

function row(page: Page) {
  return page.getByRole("row", { name: new RegExp(ACTION_TEXT) });
}

async function saveProgress(page: Page, percentage: string, description: string) {
  const progress = page.getByLabel("Progresso da ação");
  if ((await progress.count()) === 0) {
    await page.getByRole("button", { name: `Opções da ação ${ACTION_TEXT}` }).click();
    await page.getByRole("menuitem", { name: "Andamento" }).click();
  }
  await page.getByLabel("Progresso da ação").fill(percentage);
  await page.getByLabel("O que foi realizado nesta atualização?").fill(description);
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/respondent/action-plans") &&
      response.request().method() === "POST" &&
      !response.url().includes("progress-updates"),
  );
  await page.getByRole("button", { name: "Salvar atualização" }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { planId?: string; revision?: number };
  expect(body.planId).toBeTruthy();
  expect(body.revision).toEqual(expect.any(Number));
  await expect(page.getByRole("heading", { name: "Atualizar andamento" })).toHaveCount(0);
  return { planId: body.planId as string, revision: body.revision as number };
}
