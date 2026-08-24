import { expect, type Page } from "@playwright/test";

export async function createCompletedActionWithEvidence(
  page: Page,
  recommendationId: string,
  index: number,
) {
  await page.goto(`/respondente/plano-acao/${recommendationId}/acoes`);
  await expect(page.getByRole("button", { name: "Nova ação" })).toBeVisible();
  await page.getByRole("button", { name: "Nova ação" }).click();
  const actionText = `E2E: executar plano de adequação ${index + 1}`;
  await page.getByLabel("Ação ou compromisso").fill(actionText);
  await page.getByLabel("Área responsável").fill("Unidade de Integridade");
  const responsibleSelect = page.getByLabel("Respondente responsável");
  await expect(responsibleSelect).toBeEnabled();
  await responsibleSelect.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Cadastrar ação" }).click();
  await expect(page.getByText(actionText)).toBeVisible();

  await page.getByRole("button", { name: `Opções da ação ${actionText}` }).click();
  await page.getByRole("menuitem", { name: "Andamento" }).click();
  const progress = page.getByLabel("Progresso da ação");
  await progress.focus();
  await progress.press("End");
  await page
    .getByLabel("O que foi realizado nesta atualização?")
    .fill("Execução concluída no fluxo E2E.");
  await page.getByRole("button", { name: "Salvar atualização" }).click();
  await expect(page.getByRole("heading", { name: "Atualizar andamento" })).toHaveCount(0);
  await expect(
    page.getByRole("row", { name: new RegExp(actionText) }).getByText("Concluída", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Opções da ação ${actionText}` }).click();
  await page.getByRole("menuitem", { name: "Comprovantes" }).click();
  await expect(page.getByRole("heading", { name: "Comprovantes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Adicionar comprovante" }).click();
  await page.getByRole("button", { name: "Link HTTPS" }).click();
  await page.getByLabel("Título da comprovação").fill(`Comprovação E2E ${index + 1}`);
  await page
    .getByLabel("Endereço HTTPS")
    .fill(`https://example.gov.br/orienta/e2e/${index + 1}`);
  await page.getByRole("button", { name: "Adicionar comprovante" }).click();
  await expect(page.getByText("Link disponível").first()).toBeVisible();
}
