import { expect, type Page } from "@playwright/test";

type WorkbenchPayload = {
  rows: Array<{
    questionId: string;
    prompt: string;
    storagePath: string | null;
    responseRevision: number | null;
  }>;
};

type NotificationsPayload = {
  notifications: Array<{
    kind: string;
    title: string;
    action_path: string | null;
  }>;
};

export async function fetchWorkbenchPayload(page: Page, cycleId: string) {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/workbench/data?cycleId=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    return { status: response.status, body: (await response.json()) as WorkbenchPayload };
  }, cycleId);
}

export async function fetchNotifications(page: Page, kinds?: string[]) {
  const query = new URLSearchParams({ limit: "50" });
  if (kinds?.length) query.set("kinds", kinds.join(","));
  const queryString = query.toString();
  return page.evaluate(async (search) => {
    const response = await fetch(`/api/notifications?${search}`, {
      credentials: "include",
      cache: "no-store",
    });
    return { status: response.status, body: (await response.json()) as NotificationsPayload };
  }, queryString);
}

/** Aguarda avisos transacionais esperados após encerramento e emissão do relatório. */
export async function expectClosureNotifications(
  page: Page,
  cycleId: string,
) {
  const closureKinds = ["diagnostic_completed", "official_report_available"];
  await expect.poll(async () => {
    const result = await fetchNotifications(page, closureKinds);
    if (result.status !== 200) return null;
    const completed = result.body.notifications.find(
      (item) => item.kind === "diagnostic_completed",
    );
    const report = result.body.notifications.find(
      (item) => item.kind === "official_report_available",
    );
    if (
      completed?.action_path !== `/respondente/ciclos/${cycleId}` ||
      report?.action_path !== `/respondente/relatorios?cycleId=${cycleId}`
    ) {
      return null;
    }
    return { completed, report };
  }, { timeout: 60_000 }).toBeTruthy();
}

/** Preenche o campo controlado de nova pergunta de forma atômica. */
export async function typeQuestionPrompt(page: Page, prompt: string) {
  const field = page.getByLabel("Nova pergunta");
  await field.click();
  await field.fill(prompt);
  await expect(field).toHaveValue(prompt);
}

/** Submete a pergunta apenas quando o estado controlado já habilitou a ação. */
export async function addQuestion(page: Page, prompt: string) {
  const addButton = page.getByRole("button", { name: "Adicionar pergunta" });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  const questionsList = page.getByRole("list", { name: "Lista de perguntas" });
  await expect(questionsList.getByText(prompt, { exact: true })).toBeVisible();
}

/** Aguarda o binding da pergunta deixar de carregar e exibir o editor atual. */
export async function expectQuestionBindingReady(
  binding: ReturnType<Page["locator"]>,
) {
  await expect(binding.getByText("Carregando configuração…")).toHaveCount(0);
  await expect(binding.getByRole("alert")).toHaveCount(0);
  await expect(
    binding.getByLabel(/Recomendação-base/),
  ).toBeVisible();
}

/** Escolhe a opção visível do critério. O input é sr-only; o alvo real é o label. */
export async function chooseCriterionAnswer(
  card: ReturnType<Page["locator"]>,
  name: string,
) {
  const radio = card.getByRole("radio", { name, exact: true });
  await expect(radio).toBeEnabled();
  const inputId = await radio.getAttribute("id");
  if (!inputId) {
    throw new Error(`A opção "${name}" não tem id para o rótulo visível.`);
  }
  await card.locator(`label[for="${inputId}"]`).click();
  await expect(radio).toBeChecked();
}

/** Aguarda a confirmação visual de persistência do autosave do critério. */
export async function expectCriterionSaved(card: ReturnType<Page["locator"]>) {
  await expect(card.getByText("Salvo", { exact: true })).toBeVisible();
}
