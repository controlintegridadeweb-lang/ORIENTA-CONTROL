import { expect, test, type Page } from "@playwright/test";
import {
  acceptPlatformConfirm,
  clickWithPlatformConfirm,
  E2E,
  expectAdminCycleState,
  futureFortalezaDateTimeInput,
  loginAs,
  logout,
  selectOrganizationInFormAssignments,
} from "./fixtures/orienta";
import {
  addQuestion,
  chooseCriterionAnswer,
  expectCriterionSaved,
  expectQuestionBindingReady,
  fetchNotifications,
  fetchWorkbenchPayload,
  typeQuestionPrompt,
} from "./support/canonical-journey";

const E2E_EVIDENCE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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

async function createCompletedActionWithEvidence(
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
  await expect(page.getByText("Concluída").first()).toBeVisible();

  await page.getByRole("button", { name: `Opções da ação ${actionText}` }).click();
  await page.getByRole("menuitem", { name: "Comprovantes" }).click();
  await page.getByRole("button", { name: /Adicionar comprovante/ }).click();
  await page.getByRole("button", { name: "Link HTTPS" }).click();
  await page.getByLabel("Título da comprovação").fill(`Comprovação E2E ${index + 1}`);
  await page
    .getByLabel("Endereço HTTPS")
    .fill(`https://example.gov.br/orienta/e2e/${index + 1}`);
  await page.getByRole("button", { name: "Adicionar comprovante" }).click();
  await expect(page.getByText("Link disponível").first()).toBeVisible();
}

/**
 * Fluxo canônico — navegador + Next + Supabase local.
 *
 * A suíte usa autenticação, banco e Storage reais. As únicas preparações são
 * as contas isoladas e o catálogo oficial criados por scripts/testing/prepare-e2e.mjs
 * após o reset da instância local do Supabase.
 */
test.describe.serial("jornada canônica da plataforma", () => {
  // O primeiro cenário cobre wizard + publicação + lote; no CI o orçamento de 90s fica justo.
  test.describe.configure({ timeout: 180_000 });

  let cycleId = "";
  let formId = "";
  let organizationId = "";
  let evidenceQuestionId = "";
  let recommendationId = "";
  let recommendationIds: string[] = [];

  test("admin cria formulário, configura critérios, publica e abre diagnóstico", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/formularios/novo");

    await page.getByLabel("Nome do formulário").fill(E2E.formName);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/admin\/formularios\/[^/]+\/configuracao\?etapa=2/);

    const section = page.locator("#new-question-section");
    await expect(section).toBeEnabled({ timeout: 30_000 });
    await expect(section).not.toContainText("Carregando seções");
    await expect(section).not.toContainText("Nenhuma seção disponível");
    await section.selectOption({ index: 1 });

    await typeQuestionPrompt(page, E2E.evidenceQuestion);
    await page.getByLabel("Exigir evidência").check();
    await addQuestion(page, E2E.evidenceQuestion);

    // A secao selecionada persiste entre cadastros: nao e preciso reselecionar.
    await typeQuestionPrompt(page, E2E.recommendationQuestion);
    await addQuestion(page, E2E.recommendationQuestion);

    await typeQuestionPrompt(page, E2E.approvedNaQuestion);
    await addQuestion(page, E2E.approvedNaQuestion);

    await typeQuestionPrompt(page, E2E.rejectedNaQuestion);
    await addQuestion(page, E2E.rejectedNaQuestion);

    for (const prompt of [
      E2E.evidenceQuestion,
      E2E.recommendationQuestion,
      E2E.approvedNaQuestion,
      E2E.rejectedNaQuestion,
    ]) {
      const binding = page.getByTestId("question-binding").filter({ hasText: prompt });
      const header = binding.getByRole("button", { name: prompt });
      // O primeiro item do acordeao ja abre por padrao; clicar nele sem checar
      // apenas fecharia o painel e o textarea sumiria. O aria-expanded reflete o
      // estado de abertura de forma sincrona, sem depender do carregamento async.
      if ((await header.getAttribute("aria-expanded")) !== "true") {
        await header.click();
      }
      await expect(header).toHaveAttribute("aria-expanded", "true");
      await expectQuestionBindingReady(binding);
      const recommendationField = binding.getByLabel(/Recomendação-base/);

      // Preenche a recomendacao-base uma unica vez. O componente ja constroi o
      // estado a partir de prev[row.id] no updater, entao um unico fill registra
      // o valor de forma deterministica. Confirmamos pelo sinal positivo
      // "Recomendação-base configurada." (derivado do estado do React) antes de
      // salvar — assim garantimos que o PUT enviara a recomendacao, e nao null.
      const recommendationText = `E2E: executar providência para ${prompt}`;
      await recommendationField.fill(recommendationText);
      await expect(binding.getByText("Recomendação-base configurada.")).toBeVisible();

      await binding.getByRole("button", { name: "Salvar configuração" }).click();
      // A confirmacao permanece apos salvar (a config persistida tem a recomendacao).
      await expect(binding.getByText("Recomendação-base configurada.")).toBeVisible();
    }

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/etapa=3/);
    await selectOrganizationInFormAssignments(page, E2E.organizationName);
    await page.getByRole("button", { name: "Salvar seleção" }).click();
    await expect(page.getByText("Seleção de organizações salva.")).toBeVisible();

    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/etapa=4/);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/etapa=5/);
    await expect(page.getByText("Tudo pronto para publicar.")).toBeVisible();
    await page.getByRole("button", { name: "Publicar formulário" }).click();
    await expect(page).toHaveURL(/\/admin\/ciclos\/novo\?.*published=1/);

    formId = new URL(page.url()).searchParams.get("formId") ?? "";
    expect(formId).toMatch(/^[0-9a-f-]{36}$/i);

    // UI atual: lote com organizações vinculadas ao formulário (padrão "todas"),
    // abertura imediata e relatório — não há mais select "Organização atribuída".
    await expect(page.getByRole("status", { name: "Formulário publicado" })).toBeVisible();
    await page.getByLabel("Período").fill("2026 — E2E");
    await page.getByRole("radio", { name: /Abrir agora/ }).check();
    await page
      .getByLabel("Prazo de resposta")
      .fill(futureFortalezaDateTimeInput(30));

    const batchResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/cycles/batch") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^Criar e abrir 1 diagnóstico$/ }).click();
    await acceptPlatformConfirm(page, "Criar e abrir");
    const batchResponse = await batchResponsePromise;
    expect(batchResponse.ok()).toBeTruthy();
    const batchReport = (await batchResponse.json()) as {
      opened?: Array<{ id: string; organizationId: string }>;
      failed?: Array<{ organizationId: string; message: string }>;
    };
    expect(batchReport.failed ?? []).toEqual([]);
    expect(batchReport.opened).toHaveLength(1);
    cycleId = batchReport.opened?.[0]?.id ?? "";
    organizationId = batchReport.opened?.[0]?.organizationId ?? "";
    expect(cycleId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(organizationId).toMatch(/^[0-9a-f-]{36}$/i);

    await expect(
      page.getByRole("status", { name: "Resultado da criação de diagnósticos" }),
    ).toContainText("1 diagnóstico aberto");
    await page.goto(`/admin/ciclos/${cycleId}`);
    await expectAdminCycleState(page, /Em preenchimento|Em resposta/);
    await logout(page);
  });

  test("RLS bloqueia organização externa no navegador e na API autenticada", async ({ page }) => {
    expect(cycleId).toBeTruthy();
    await assertOutsiderCannotAccessCycle(page, cycleId);
  });

  test("respondente responde, envia arquivo ao Storage e finaliza o envio", async ({ page }) => {
    expect(cycleId).toBeTruthy();
    await loginAs(page, "respondent");
    await page.goto(`/respondente/ciclos/${cycleId}`);
    await expect(page.getByText(E2E.evidenceQuestion, { exact: true })).toBeVisible();

    const initialPayload = await fetchWorkbenchPayload(page, cycleId);
    expect(initialPayload.status).toBe(200);
    evidenceQuestionId = initialPayload.body.rows.find(
      (row) => row.prompt === E2E.evidenceQuestion,
    )?.questionId ?? "";
    expect(evidenceQuestionId).toMatch(/^[0-9a-f-]{36}$/i);

    const evidenceCard = page.locator("li").filter({ hasText: E2E.evidenceQuestion });
    // A pergunta exige evidência: "Sim" revela a área de anexo. O teste usa
    // um PNG estruturalmente válido, que respeita a mesma allowlist da produção.
    await chooseCriterionAnswer(evidenceCard, "Sim");
    await evidenceCard.locator('input[type="file"]').setInputFiles({
      name: "evidencia-e2e.png",
      mimeType: "image/png",
      buffer: E2E_EVIDENCE_PNG,
    });
    await expect(evidenceCard.getByLabel("Novas evidências")).toBeVisible();
    await evidenceCard.getByLabel(/^Título/).fill("Evidência E2E");
    await evidenceCard.getByRole("button", { name: "Salvar resposta" }).click();
    await expect(
      evidenceCard.getByText("Evidência enviada e aguardando validação."),
    ).toBeVisible();

    const recommendationCard = page.locator("li").filter({ hasText: E2E.recommendationQuestion });
    const recommendationSave = page.waitForResponse(
      (response) =>
        response.url().includes("/api/workbench/response") &&
        response.request().method() === "POST",
    );
    await chooseCriterionAnswer(recommendationCard, "Não");
    expect((await recommendationSave).ok()).toBeTruthy();
    await expectCriterionSaved(recommendationCard);

    for (const [prompt, justification] of [
      [
        E2E.approvedNaQuestion,
        "A organização não possui competência legal ou operacional sobre este critério.",
      ],
      [
        E2E.rejectedNaQuestion,
        "A unidade decidiu internamente não executar este critério durante o período.",
      ],
    ] as const) {
      const card = page.locator("li").filter({ hasText: prompt });
      await chooseCriterionAnswer(card, "Não se aplica neste diagnóstico");
      await card.getByLabel("Justificativa").fill(justification);
      await card.getByRole("button", { name: "Salvar justificativa" }).click();
      await expect(card.getByText("Aguardando validação da administração.")).toBeVisible();
    }

    const savedPayload = await fetchWorkbenchPayload(page, cycleId);
    const savedEvidence = savedPayload.body.rows.find((row) => row.questionId === evidenceQuestionId);
    expect(savedEvidence?.storagePath).toMatch(new RegExp(`^${organizationId}/${cycleId}/`));

    // O envio pede confirmacao no modal da plataforma; sem aceitar, o envio e abortado.
    await page.getByRole("button", { name: "Revisar e enviar diagnóstico" }).click();
    await acceptPlatformConfirm(page, "Enviar");
    await expect(page).toHaveURL(new RegExp(`/respondente/ciclos/${cycleId}/enviado`));
    await expect(
      page.getByRole("heading", { name: "Diagnóstico enviado para validação" }),
    ).toBeVisible();
    await expect(page.getByText("Aguardando validação", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver respostas enviadas" })).toBeVisible();
    await logout(page);
  });

  test("admin solicita ajuste e o diagnóstico retorna para o respondente", async ({ page }) => {
    expect(cycleId).toBeTruthy();
    await loginAs(page, "admin");
    const pendingNotifications = await fetchNotifications(page);
    expect(pendingNotifications.status).toBe(200);
    const pendingValidation = pendingNotifications.body.notifications.find(
      (item) => item.kind === "validation_pending",
    );
    expect(pendingValidation?.action_path).toBe(`/admin/ciclos/${cycleId}`);

    await page.goto(`/admin/ciclos/${cycleId}`);
    // O status do ciclo aparece num <dd> (role "definition") e tambem em prosa
    // (<strong>); escopamos ao campo de status para evitar strict mode.
    await expectAdminCycleState(page, /^Enviado$/);

    await clickWithPlatformConfirm(page, "Iniciar validação");
    await expectAdminCycleState(page, /^Em validação$/);
    await page.getByRole("link", { name: /Revisar validação do diagnóstico/ }).click();
    await expect(page.getByRole("heading", { name: "Validação do diagnóstico" })).toBeVisible();

    const approvedNaCard = page.getByRole("article").filter({ hasText: E2E.approvedNaQuestion });
    await approvedNaCard.getByRole("button", { name: 'Aceitar “Não se aplica”', exact: true }).click();
    await approvedNaCard.getByRole("button", { name: /Confirmar Aceitar/ }).click();
    await expect(approvedNaCard.getByText("Aceito", { exact: true })).toBeVisible();

    const rejectedNaCard = page.getByRole("article").filter({ hasText: E2E.rejectedNaQuestion });
    await rejectedNaCard.getByRole("button", { name: 'Rejeitar “Não se aplica”', exact: true }).click();
    await rejectedNaCard
      .getByLabel(/Motivo da rejeição/)
      .fill("O critério é aplicável e deve ser respondido como Não.");
    await rejectedNaCard
      .getByRole("button", { name: /Confirmar Rejeitar/i })
      .click();
    await expect(rejectedNaCard.getByText("Rejeitado", { exact: true })).toBeVisible();

    const evidenceValidationCard = page
      .getByRole("article")
      .filter({ hasText: E2E.evidenceQuestion });
    await evidenceValidationCard.getByRole("button", { name: "Solicitar ajuste" }).click();
    await evidenceValidationCard
      .getByPlaceholder("Selecione uma resposta padrão ou escreva uma justificativa")
      .fill("Substitua o arquivo por uma versão atualizada.");
    await evidenceValidationCard
      .getByRole("button", { name: "Confirmar: Solicitar ajuste" })
      .click();
    await expect(evidenceValidationCard.getByText("Ajuste solicitado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enviar solicitações de ajuste" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/ciclos/${cycleId}\\?validation=adjustment_requested`));
    await expectAdminCycleState(page, /^Aguardando correção do respondente$/);
    await expect(page.getByText("Ajuste solicitado à organização.")).toBeVisible();
    await logout(page);
  });

  test("respondente corrige arquivo, cria plano, admin valida e encerra", async ({ page }) => {
    expect(cycleId).toBeTruthy();
    expect(formId).toBeTruthy();
    expect(organizationId).toBeTruthy();

    await loginAs(page, "respondent");
    const respondentNotifications = await fetchNotifications(page);
    expect(respondentNotifications.status).toBe(200);
    const validationStarted = respondentNotifications.body.notifications.find(
      (item) => item.kind === "diagnostic_validation_started",
    );
    expect(validationStarted?.action_path).toBe(`/respondente/ciclos/${cycleId}`);

    await page.goto(`/respondente/ciclos/${cycleId}`);
    // No painel do respondente o ciclo devolvido aparece como "Correções solicitadas".
    // O status surge no cabecalho do diagnostico (article) e tambem fora dele;
    // escopa ao article para evitar strict mode.
    await expect(page.getByRole("article").getByText(/Correções solicitadas/i)).toBeVisible();

    const evidenceCard = page.locator("li").filter({ hasText: E2E.evidenceQuestion });
    await expect(evidenceCard.getByText("Preservada no histórico")).toBeVisible();
    await evidenceCard.locator('input[type="file"]').setInputFiles({
      name: "evidencia-e2e-corrigida.png",
      mimeType: "image/png",
      buffer: E2E_EVIDENCE_PNG,
    });
    await evidenceCard.getByLabel(/T[íi]tulo/i).last().fill("Evidência E2E corrigida");
    await evidenceCard.getByRole("button", { name: "Salvar resposta" }).click();
    await expect(
      evidenceCard.getByText("Nova evidência registrada. Revise a correção e reenvie o diagnóstico."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Revisar e reenviar correções" }).click();
    await acceptPlatformConfirm(page, "Reenviar correções");
    await expect(page).toHaveURL(new RegExp(`/respondente/ciclos/${cycleId}/enviado`));
    await expect(
      page.getByRole("heading", { name: "Correções reenviadas para validação" }),
    ).toBeVisible();
    await logout(page);

    await loginAs(page, "admin");
    const adminNotifications = await fetchNotifications(page);
    expect(adminNotifications.status).toBe(200);
    const resubmitted = adminNotifications.body.notifications.find(
      (item) => item.kind === "validation_resubmitted",
    );
    expect(resubmitted?.action_path).toBe(`/admin/ciclos/${cycleId}/validacao`);

    await page.goto(`/admin/ciclos/${cycleId}`);
    await expectAdminCycleState(page, /^Em validação$/);
    await page.getByRole("link", { name: /Revisar validação do diagnóstico/ }).click();
    const evidenceValidationCard = page
      .getByRole("article")
      .filter({ hasText: E2E.evidenceQuestion });
    await evidenceValidationCard.getByRole("button", { name: "Aprovar", exact: true }).click();
    await evidenceValidationCard.getByRole("button", { name: "Confirmar: Aprovar" }).click();
    await expect(page.getByRole("button", { name: "Concluir validação e calcular FAMI" })).toBeVisible();
    await page.getByRole("button", { name: "Concluir validação e calcular FAMI" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/ciclos/${cycleId}`));
    await expectAdminCycleState(page, /^Diagnóstico concluído$/);
    await expect(page.getByText("Validação concluída e resultado FAMI calculado.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver Resultado FAMI" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver recomendações" })).toBeVisible();

    const famiResultAfterValidation = await page.evaluate(async (id) => {
      const response = await fetch(`/api/fami/snapshot?cycleId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    }, cycleId);
    expect(famiResultAfterValidation.status).toBe(200);
    expect(famiResultAfterValidation.body.snapshot.global.pointsObtained).toBeCloseTo(2);
    expect(famiResultAfterValidation.body.snapshot.global.pointsPossible).toBeCloseTo(4);

    const recommendationResult = await page.evaluate(async (id) => {
      const response = await fetch(`/api/admin/action-plans?cycleId=${encodeURIComponent(id)}&limit=50`, {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    }, cycleId);
    expect(recommendationResult.status).toBe(200);
    const recommendationItems = recommendationResult.body.items as Array<{
      recommendationId: string;
      questionPrompt: string;
    }>;
    recommendationId = recommendationItems.find(
      (item) => item.questionPrompt === E2E.recommendationQuestion,
    )?.recommendationId ?? "";
    expect(recommendationId).toMatch(/^[0-9a-f-]{36}$/i);
    recommendationIds = recommendationItems.map((item) => item.recommendationId);
    expect(recommendationIds.length).toBeGreaterThanOrEqual(2);
    expect(
      recommendationItems.some((item) => item.questionPrompt === E2E.rejectedNaQuestion),
    ).toBe(true);
    expect(
      recommendationItems.some((item) => item.questionPrompt === E2E.approvedNaQuestion),
    ).toBe(false);
    await logout(page);

    await loginAs(page, "respondent");
    for (const [index, currentRecommendationId] of recommendationIds.entries()) {
      await createCompletedActionWithEvidence(page, currentRecommendationId, index);
    }
    await logout(page);

    await loginAs(page, "admin");
    for (const currentRecommendationId of recommendationIds) {
      await page.goto(`/admin/plano-acao/${currentRecommendationId}/monitoramento`);
      await expect(page.getByRole("button", { name: "Registrar acompanhamento" })).toBeVisible();
      await page.getByRole("button", { name: "Registrar acompanhamento" }).click();
      await page.getByLabel("Tipo").selectOption("approval");
      await page.getByLabel("Registro").fill("Execução concluída e aceita no fluxo E2E.");
      await page.getByRole("button", { name: "Publicar acompanhamento" }).click();
      await expect(page.getByText("Aceite vigente").first()).toBeVisible();
    }
    await page.goto(`/admin/ciclos/${cycleId}`);
    await clickWithPlatformConfirm(page, "Encerrar avaliação");
    await expectAdminCycleState(page, /^Avaliação encerrada$/);
    await page.getByRole("link", { name: "Ver Resultado FAMI" }).click();
    await expect(page.getByRole("heading", { name: "Resultado FAMI" })).toBeVisible();

    const famiResultAfterClosing = await page.evaluate(async (id) => {
      const response = await fetch(`/api/fami/snapshot?cycleId=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    }, cycleId);
    expect(famiResultAfterClosing.status).toBe(200);
    expect(famiResultAfterClosing.body.snapshot.global.pointsObtained).toBeCloseTo(
      famiResultAfterValidation.body.snapshot.global.pointsObtained,
    );
    expect(famiResultAfterClosing.body.snapshot.global.pointsPossible).toBeCloseTo(
      famiResultAfterValidation.body.snapshot.global.pointsPossible,
    );

    await page.goto(
      `/admin/relatorios?organizationId=${encodeURIComponent(organizationId)}&cycleId=${encodeURIComponent(cycleId)}`,
    );
    // Ha um <h1> e um <h2> com "Relatórios"; escopa ao titulo principal (nivel 1).
    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Organização")).toHaveValue(organizationId);
    await expect(page.getByLabel("Diagnóstico")).toHaveValue(cycleId);

    await expect(page.getByText(/Relatório disponível/i).first()).toBeVisible();
    await expect(page.getByText(/Emissão v1/i).first()).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar" }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^relatorio-orienta-.*-emissao-1-.*\.pdf$/);
    await logout(page);
  });

  test("ciclo concluído bloqueia edição e pode ser reaberto pelo administrador", async ({ page }) => {
    expect(cycleId).toBeTruthy();
    expect(evidenceQuestionId).toBeTruthy();

    await loginAs(page, "respondent");
    const finalNotifications = await fetchNotifications(page);
    expect(finalNotifications.status).toBe(200);
    const completedNotification = finalNotifications.body.notifications.find(
      (item) => item.kind === "diagnostic_completed",
    );
    const reportNotification = finalNotifications.body.notifications.find(
      (item) => item.kind === "official_report_available",
    );
    expect(completedNotification?.action_path).toBe(
      `/respondente/ciclos/${cycleId}`,
    );
    expect(reportNotification?.action_path).toBe(
      `/respondente/relatorios?cycleId=${cycleId}`,
    );

    const blocked = await page.evaluate(
      async ({ cycle, question }) => {
        const response = await fetch("/api/workbench/response", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleId: cycle,
            questionId: question,
            answer: "yes",
            notes: "Tentativa de editar diagnóstico concluído.",
          }),
        });
        return { status: response.status, body: await response.json() };
      },
      { cycle: cycleId, question: evidenceQuestionId },
    );
    // Ciclo concluído tem resposta dedicada 403 ("solicite reabertura"), distinta
    // do 409 generico de estados nao-editaveis (submitted/in_validation).
    expect(blocked.status).toBe(403);
    await logout(page);

    await loginAs(page, "admin");
    await page.goto(`/admin/ciclos/${cycleId}`);
    await expectAdminCycleState(page, /^Avaliação encerrada$/);
    await page
      .getByLabel("Justificativa da reabertura")
      .fill("Correção controlada do diagnóstico no fluxo E2E.");
    await page
      .getByLabel("Novo prazo de resposta")
      .fill(futureFortalezaDateTimeInput(7));
    await clickWithPlatformConfirm(page, "Reabrir diagnóstico");
    await expectAdminCycleState(page, /Em preenchimento|Em resposta/);
    await expect(page.getByText(/Reaberturas/i)).toBeVisible();
    await logout(page);

    await loginAs(page, "respondent");
    const reopened = await page.evaluate(
      async ({ cycle, question }) => {
        const response = await fetch("/api/workbench/response", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleId: cycle,
            questionId: question,
            answer: "yes",
            notes: "Edição autorizada após reabertura.",
          }),
        });
        return { status: response.status, body: await response.json() };
      },
      { cycle: cycleId, question: evidenceQuestionId },
    );
    expect(reopened.status).toBe(200);
  });
});
