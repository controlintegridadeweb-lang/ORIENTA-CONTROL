import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3003";
const requested = process.env.PLAYWRIGHT_BASE_URL;
if (
  requested &&
  requested !== "http://127.0.0.1:3003" &&
  requested !== "http://localhost:3003"
) {
  throw new Error(
    "O Playwright de homologação só aceita a porta 3003. O servidor de localhost:3002 carrega o .env.local oficial.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/testing/start-homologacao.mjs",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        ORIENTA_TARGET: "homologacao",
        NEXT_PUBLIC_APP_URL: baseURL,
        PLAYWRIGHT_BASE_URL: baseURL,
      }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0),
    ),
  },
});
