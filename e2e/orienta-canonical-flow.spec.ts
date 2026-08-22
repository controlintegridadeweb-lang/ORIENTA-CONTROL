import { expect, test, type Page } from "@playwright/test";
import { loginAs, logout } from "./fixtures/orienta";
import { fetchWorkbenchPayload } from "./support/canonical-journey";
import {
  adminCreatesFormAndOpensCycle,
  adminRequestsAdjustment,
  completedCycleBlocksAndReopens,
  createCanonicalJourneyState,
  respondentCorrectsAndAdminCloses,
  respondentSubmitsDiagnostic,
} from "./support/canonical-flow-steps";

async function assertOutsiderCannotAccessCycle(page: Page, cycleId: string) {
  await loginAs(page, "outsider");

  const denied = await fetchWorkbenchPayload(page, cycleId);
  expect(denied.status).toBe(403);
  await expect(page).not.toHaveURL(new RegExp(`/respondente/ciclos/${cycleId}`));

  await page.goto(`/respondente/ciclos/${cycleId}`);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(page.getByText("Este endereço não está disponível.")).toBeVisible();
  await logout(page);
}

/**
 * Fluxo canônico — navegador + Next + Supabase local.
 *
 * A suíte usa autenticação, banco e Storage reais. As únicas preparações são
 * as contas isoladas e o catálogo oficial criados por scripts/testing/prepare-e2e.mjs
 * após o reset da instância local do Supabase.
 */
test.describe.serial("jornada canônica da plataforma", () => {
  test.describe.configure({ timeout: 180_000 });

  const state = createCanonicalJourneyState();

  test("admin cria formulário, configura critérios, publica e abre diagnóstico", async ({
    page,
  }) => {
    await adminCreatesFormAndOpensCycle(page, state);
  });

  test("RLS bloqueia organização externa no navegador e na API autenticada", async ({
    page,
  }) => {
    expect(state.cycleId).toBeTruthy();
    await assertOutsiderCannotAccessCycle(page, state.cycleId);
  });

  test("respondente responde, envia arquivo ao Storage e finaliza o envio", async ({
    page,
  }) => {
    await respondentSubmitsDiagnostic(page, state);
  });

  test("admin solicita ajuste e o diagnóstico retorna para o respondente", async ({
    page,
  }) => {
    await adminRequestsAdjustment(page, state);
  });

  test("respondente corrige arquivo, cria plano, admin valida e encerra", async ({
    page,
  }) => {
    await respondentCorrectsAndAdminCloses(page, state);
  });

  test("ciclo concluído bloqueia edição e pode ser reaberto pelo administrador", async ({
    page,
  }) => {
    await completedCycleBlocksAndReopens(page, state);
  });
});
