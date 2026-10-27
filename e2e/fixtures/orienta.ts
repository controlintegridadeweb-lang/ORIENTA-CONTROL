import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Cookie, type Page } from "@playwright/test";
import { journeyFormName } from "./execution-id";

export const E2E = {
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "admin.e2e@orienta.local",
  respondentEmail: process.env.E2E_RESPONDENT_EMAIL ?? "respondente.e2e@orienta.local",
  outsiderEmail: process.env.E2E_OUTSIDER_EMAIL ?? "respondente.externo.e2e@orienta.local",
  password: process.env.E2E_PASSWORD ?? "OrientaE2E!2026",
  organizationName: process.env.E2E_ORGANIZATION_NAME ?? "Órgão de Teste E2E",
  outsiderOrganizationName:
    process.env.E2E_OUTSIDER_ORGANIZATION_NAME ?? "Órgão Externo E2E",
  formName: journeyFormName(),
  evidenceQuestion: "E2E: a unidade possui procedimento de integridade formalizado?",
  recommendationQuestion: "E2E: existe plano de integridade e compliance institucional monitorado?",
  approvedNaQuestion: "E2E: este critério não se aplica por ausência de competência legal?",
  rejectedNaQuestion: "E2E: este critério não se aplica por decisão interna da unidade?",
};

export type E2ERole = "admin" | "respondent" | "outsider";

const ADMIN_TOTP_FILE = "var/e2e-admin-totp.local";
const ACTIVE_ROLE_FILE = "var/e2e-active-role.local";
const sessionFile = (role: E2ERole) => `var/e2e-session-${role}.json`;

function readStoredTotp(): string | null {
  try {
    const secret = readFileSync(ADMIN_TOTP_FILE, "utf8").trim();
    return secret || null;
  } catch {
    return null;
  }
}

function storeTotp(secret: string) {
  mkdirSync("var", { recursive: true });
  writeFileSync(ADMIN_TOTP_FILE, secret, { encoding: "utf8", mode: 0o600 });
}

let adminTotpSecret: string | null = readStoredTotp();

function decodeBase32(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Chave TOTP inválida no E2E.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, now = Date.now()): string {
  const counter = Math.floor(now / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

async function completeAdminMfa(page: Page) {
  await expect(page).toHaveURL(/\/auth\/mfa/);
  await expect(page.getByRole("heading", { name: "Autenticação em duas etapas" })).toBeVisible();

  const manualKey = page.locator("p").filter({ hasText: /Chave manual:/ });
  const enrolling = await manualKey
    .waitFor({ state: "visible", timeout: adminTotpSecret ? 3_000 : 30_000 })
    .then(() => true)
    .catch(() => false);
  if (enrolling) {
    // O enroll é assíncrono (SDK do Auth). getByText(/Chave manual:/) casa o
    // <strong> interno e o innerText vem sem o segredo.
    const secret = (await manualKey.innerText()).replace(/^Chave manual:\s*/i, "").trim();
    if (!secret) {
      throw new Error("O E2E não encontrou a chave TOTP do administrador.");
    }
    adminTotpSecret = secret;
    storeTotp(secret);
  } else if (!adminTotpSecret) {
    throw new Error(
      "O administrador já possui TOTP e esta execução não guardou a chave. Remova o fator fictício antes de repetir.",
    );
  }

  const codeField = page.getByLabel("Código de seis dígitos");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remainingInWindow = 30_000 - (Date.now() % 30_000);
    if (remainingInWindow < 3_000) {
      await page.waitForTimeout(remainingInWindow + 250);
    }
    await codeField.fill(totpCode(adminTotpSecret));
    await page.getByRole("button", { name: "Confirmar acesso" }).click();
    try {
      await page.waitForURL(/\/admin(?:\?.*)?$/, { timeout: 10_000 });
      return;
    } catch {
      if (attempt === 1) {
        const message = await page.getByRole("alert").innerText().catch(() => "Código TOTP não confirmado.");
        throw new Error(message);
      }
    }
  }
}


type StoredCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: Cookie["sameSite"];
};

function readSession(role: E2ERole): StoredCookie[] | null {
  try {
    const parsed = JSON.parse(readFileSync(sessionFile(role), "utf8")) as StoredCookie[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persistableCookies(cookies: Cookie[]): StoredCookie[] {
  return cookies.map((cookie) => {
    const next: StoredCookie = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    };
    if (cookie.expires > 0) next.expires = cookie.expires;
    return next;
  });
}

function writeSession(role: E2ERole, cookies: Cookie[]) {
  const persistable = persistableCookies(cookies);
  if (persistable.length === 0) return;
  mkdirSync("var", { recursive: true });
  writeFileSync(sessionFile(role), JSON.stringify(persistable), { encoding: "utf8", mode: 0o600 });
  writeFileSync(ACTIVE_ROLE_FILE, role, { encoding: "utf8", mode: 0o600 });
}

async function restoreSession(page: Page, role: E2ERole): Promise<boolean> {
  const cookies = readSession(role);
  if (!cookies) return false;
  await page.context().clearCookies();
  await page.context().addCookies(cookies);
  await page.goto(role === "admin" ? "/admin" : "/respondente");
  const expected = role === "admin" ? /\/admin(?:\/|$|\?)/ : /\/respondente(?:\/|$|\?)/;
  try {
    await page.waitForURL(expected, { timeout: 15_000 });
  } catch {
    // Cookies de outro papel deixam a sessão antiga no navegador e o login
    // nem chega a aparecer. A falha de restauração volta ao formulário limpo.
    await page.context().clearCookies();
    return false;
  }
  writeSession(role, await page.context().cookies());
  return true;
}

export async function loginAs(page: Page, role: E2ERole) {
  if (await restoreSession(page, role)) return;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrar na conta" })).toBeVisible();


  const email =
    role === "admin"
      ? E2E.adminEmail
      : role === "respondent"
        ? E2E.respondentEmail
        : E2E.outsiderEmail;
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(E2E.password);
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();

  const expectedUrl = role === "admin" ? /\/admin(?:\?.*)?$/ : /\/respondente(?:\?.*)?$/;
  // Escopo no <form>: o App Router injeta `#__next-route-announcer__` com
  // role="alert" (muitas vezes vazio) e um getByRole("alert") global gera falso positivo.
  const formAlert = page.locator("form").getByRole("alert");
  try {
    if (role === "admin") {
      await Promise.race([
        page.waitForURL(/\/auth\/mfa|\/admin(?:\?.*)?$/, { timeout: 30_000 }),
        formAlert.waitFor({ state: "visible", timeout: 30_000 }).then(async () => {
          const message = (await formAlert.innerText()).trim();
          throw new Error(`Login como ${role} falhou na UI: ${message || "(sem mensagem)"}`);
        }),
      ]);
      if (/\/auth\/mfa/.test(page.url())) await completeAdminMfa(page);
    } else {
      await Promise.race([
        page.waitForURL(expectedUrl, { timeout: 30_000 }),
        formAlert.waitFor({ state: "visible", timeout: 30_000 }).then(async () => {
          const message = (await formAlert.innerText()).trim();
          throw new Error(`Login como ${role} falhou na UI: ${message || "(sem mensagem)"}`);
        }),
      ]);
    }
    await page.waitForURL(expectedUrl, { timeout: 30_000 });
  } catch (error) {
    const url = page.url();
    const heading = await page
      .getByRole("heading")
      .first()
      .innerText()
      .catch(() => "(sem heading)");
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${detail} | url=${url} | heading=${heading}`);
  }
  await expect(page).toHaveURL(expectedUrl);
  writeSession(role, await page.context().cookies());
}

export async function logout(page: Page) {
  // A rota de login aceita 8 tentativas por conta a cada 15 minutos.
  // A troca de papel grava os cookies atuais, limpa o navegador e restaura a
  // sessão já autenticada. Não clica em Sair, para não revogar o fator TOTP.
  try {
    const role = readFileSync(ACTIVE_ROLE_FILE, "utf8").trim();
    if (role === "admin" || role === "respondent" || role === "outsider") {
      writeSession(role, await page.context().cookies());
    }
  } catch {
    // A primeira visita ainda não autenticou ninguém.
  }
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrar na conta" })).toBeVisible();
}

/** Marca uma organização na etapa de atribuições do formulário. */
export async function selectOrganizationInFormAssignments(page: Page, organizationName: string) {
  await expect(page.getByText("Carregando organizações…")).toBeHidden();

  const search = page.getByRole("searchbox", { name: "Buscar organização" });
  await search.fill(organizationName);

  const checkbox = page.getByRole("checkbox", { name: organizationName, exact: true });
  await expect(checkbox).toBeVisible({ timeout: 15_000 });
  await checkbox.check();
}


/** Gera valor futuro para input datetime-local no fuso oficial da plataforma. */
export function futureFortalezaDateTimeInput(daysAhead: number): string {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(target);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Confirma o modal da plataforma (substitui window.confirm nos fluxos da UI). */
export async function acceptPlatformConfirm(page: Page, confirmLabel: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel, exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Clica numa ação que abre o modal de confirmação e aceita em seguida. */
export async function clickWithPlatformConfirm(
  page: Page,
  actionLabel: string,
  confirmLabel: string = actionLabel,
) {
  await page.getByRole("button", { name: actionLabel, exact: true }).click();
  await acceptPlatformConfirm(page, confirmLabel);
}

/** Verifica a situação exibida no painel do diagnóstico administrativo. */
export async function expectAdminCycleState(page: Page, pattern: RegExp | string) {
  const stateValues = page.getByRole("main").locator("dl > div").filter({
    has: page.locator("dt", { hasText: /^(Estado|Situação)$/ }),
  }).locator("dd");
  const expected = pattern instanceof RegExp ? pattern : new RegExp(`^${escapeRegExp(pattern)}$`);

  await expect(async () => {
    const texts = (await stateValues.allTextContents()).map((text) => text.replace(/\s+/g, " ").trim());
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).toMatch(expected);
  }).toPass({ timeout: 15_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
