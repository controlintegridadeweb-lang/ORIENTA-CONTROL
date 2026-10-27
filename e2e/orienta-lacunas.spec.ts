import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { E2E, loginAs, logout } from "./fixtures/orienta";

const MEMBER_EMAIL = "membro.lacuna@orienta.test";
const MEMBER_NAME = "Membro Lacuna E2E";

function memberRow(page: Page) {
  return page.getByRole("article").filter({
    has: page.locator(`input[value="${MEMBER_EMAIL}"]`),
  });
}

test.describe.serial("lacunas de homologação", () => {
  test.setTimeout(180_000);

  test("admin cadastra integrante no órgão e outro órgão não administra usuários", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { name: "Criar respondente" })).toBeVisible();

    const createForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "Criar respondente" }),
    });
    await createForm.getByLabel("E-mail").fill(MEMBER_EMAIL);
    await createForm.getByLabel("Organização").selectOption({ label: E2E.organizationName });
    await createForm.getByRole("button", { name: "Criar respondente" }).click();
    await expect(createForm.getByLabel("Cargo")).toHaveJSProperty("validity.valueMissing", true);

    await createForm.getByLabel("Cargo").selectOption("titular");
    await createForm.getByLabel("Senha provisória (opcional)").fill("curta123");
    await createForm.getByRole("button", { name: "Criar respondente" }).click();
    await expect(createForm.getByLabel("Senha provisória (opcional)")).toHaveJSProperty(
      "validity.tooShort",
      true,
    );

    await page.goto(`/admin/usuarios?q=${encodeURIComponent(MEMBER_EMAIL)}`);
    const existing = memberRow(page);
    if ((await existing.count()) === 0) {
      await page.goto("/admin/usuarios");
      await createForm.getByLabel("E-mail").fill(MEMBER_EMAIL);
      await createForm.getByLabel("Nome (opcional)").fill(MEMBER_NAME);
      await createForm.getByLabel("Organização").selectOption({ label: E2E.organizationName });
      await createForm.getByLabel("Cargo").selectOption("suplente");
      await createForm.getByLabel("Senha provisória (opcional)").fill(E2E.password);
      await createForm.getByRole("button", { name: "Criar respondente" }).click();
      await expect(page.getByText(`Respondente ${MEMBER_EMAIL} criado com senha provisória.`)).toBeVisible();
      await page.goto(`/admin/usuarios?q=${encodeURIComponent(MEMBER_EMAIL)}`);
    }

    const row = memberRow(page);
    await expect(row).toBeVisible();
    await expect(row.getByLabel("Cargo")).toHaveValue("suplente");
    await expect(row.getByLabel("Organização").locator("option:checked")).toHaveText(
      E2E.organizationName,
    );
    await page.reload();
    await expect(row.getByLabel("Cargo")).toHaveValue("suplente");

    await logout(page);
    await loginAs(page, "outsider");
    await page.goto("/admin/usuarios");
    await expect(page).toHaveURL(/\/respondente/);
    await expect(page.getByRole("button", { name: "Criar respondente" })).toHaveCount(0);
  });

  test("ciclo reaberto não oferece novo acompanhamento percentual", async ({ page }) => {
    await loginAs(page, "respondent");
    const progress = await page.evaluate(async () => {
      const response = await fetch("/api/respondent/dashboard/forms-progress?year=2026", {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(progress.status).toBe(200);
    const reopened = (progress.body.items ?? []).find(
      (item: { formName?: string; state?: string; cycleId?: string }) =>
        item.formName === "Diagnóstico E2E - Jornada Canônica" && item.state === "in_response",
    );
    const reopenedCycleId = reopened?.cycleId ?? "";
    expect(reopenedCycleId, JSON.stringify(progress.body.items)).toMatch(/^[0-9a-f-]{36}$/i);

    const listed = await page.evaluate(async () => {
      const response = await fetch("/api/respondent/action-plans?view=overview&limit=50", {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(listed.status).toBe(200);
    const fromReopenedCycle = (listed.body.items ?? []).filter(
      (item: { cycleId?: string }) => item.cycleId === reopenedCycleId,
    );
    expect(fromReopenedCycle).toHaveLength(0);

    await page.goto(`/respondente/ciclos/${reopenedCycleId}`);
    await expect(page).toHaveURL(new RegExp(`/respondente/ciclos/${reopenedCycleId}(?:\\?.*)?$`));
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova ação" })).toHaveCount(0);

    await logout(page);
    await loginAs(page, "outsider");
    const outsider = await page.evaluate(async () => {
      const response = await fetch("/api/respondent/action-plans?view=overview&limit=50", {
        credentials: "include",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(outsider.status).toBe(200);
    const formNames = (outsider.body.items ?? []).map(
      (item: { formName?: string }) => item.formName,
    );
    expect(formNames).not.toContain(E2E.formName);
  });

  test("relatório oficial persiste como PDF e outro órgão não baixa o arquivo", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await loginAs(page, "admin");
    await page.goto("/admin/relatorios");
    await expect(page.getByRole("heading", { name: "Relatórios", level: 1 })).toBeVisible();
    await page.getByLabel("Organização").selectOption({ label: E2E.organizationName });
    const history = page.getByRole("list", { name: "Histórico de emissões" });
    await expect(history.getByRole("button", { name: "Baixar", exact: true }).first()).toBeVisible();

    const downloadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/reports/") && response.url().includes("/download"),
    );
    const downloadEvent = page.waitForEvent("download");
    await history.getByRole("button", { name: "Baixar", exact: true }).first().click();
    const apiResponse = await downloadResponse;
    const reportId = new URL(apiResponse.url()).pathname.split("/").at(-2);
    expect(reportId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(apiResponse.status()).toBe(200);
    const signed = (await apiResponse.json()) as { url?: string };
    expect(signed.url ?? "").toContain("/object/sign/relatorios/");
    expect(apiResponse.headers()["x-report-integrity"]).toBe("persisted-and-hashed");
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const bytes = readFileSync(filePath!);
    expect(bytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);

    const signedUrl = signed.url ?? "";
    const fresh = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const header = new Uint8Array(await response.arrayBuffer()).slice(0, 5);
      return { status: response.status, header: Array.from(header) };
    }, signedUrl);
    expect(fresh.status).toBe(200);
    expect(Buffer.from(fresh.header).toString("utf8")).toBe("%PDF-");
    await page.waitForTimeout(70_000);
    const expired = await page.evaluate(async (url) => {
      const response = await fetch(url);
      return response.status;
    }, signedUrl);
    expect(expired).not.toBe(200);

    await logout(page);
    await loginAs(page, "outsider");
    const denied = await page.evaluate(async (id) => {
      const response = await fetch(`/api/reports/${id}/download`, { credentials: "include" });
      return { status: response.status, body: await response.text() };
    }, reportId);
    expect(denied.status).toBe(403);
    expect(denied.body).not.toContain("/object/sign/");

    const anonymous = await request.get(`/api/reports/${reportId}/download`);
    expect(anonymous.status()).toBe(401);
    expect(await anonymous.text()).not.toContain("/object/sign/");
  });
});
