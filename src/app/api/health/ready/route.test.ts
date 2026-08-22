import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorized: true, readiness: { ready: true, checks: [{ name: "configuration", status: "pass", durationMs: 1 }, { name: "database", status: "pass", durationMs: 2 }] }, logError: vi.fn() }));
vi.mock("@/infrastructure/health/build-information", () => ({ getBuildInformation: () => ({ service: "orienta", version: "1.0.0-rc.1", commit: "abc123def456", environment: "test" }) }));
vi.mock("@/infrastructure/health/health-authorization", () => ({ isReadinessRequestAuthorized: () => mocks.authorized }));
vi.mock("@/infrastructure/health/readiness-service", () => ({ evaluateReadiness: vi.fn(async () => mocks.readiness) }));
vi.mock("@/infrastructure/observability/logger", () => ({ logError: mocks.logError }));
import { GET } from "./route";
const request = () => new Request("https://orienta.test/api/health/ready", { headers: { "x-request-id": "request-ready-123" } });
describe("GET /api/health/ready", () => {
  beforeEach(() => { mocks.authorized = true; mocks.readiness = { ready: true, checks: [{ name: "configuration", status: "pass", durationMs: 1 }, { name: "database", status: "pass", durationMs: 2 }] }; mocks.logError.mockClear(); });
  it("não expõe a prontidão sem o segredo operacional", async () => { mocks.authorized = false; const response = await GET(request()); expect(response.status).toBe(401); expect(response.headers.get("Cache-Control")).toContain("no-store"); });
  it("retorna 503 quando alguma dependência não está pronta", async () => { mocks.readiness = { ready: false, checks: [{ name: "database", status: "fail", durationMs: 10 }] }; const response = await GET(request()); expect(response.status).toBe(503); expect((await response.json()).status).toBe("not_ready"); });
  it("retorna 200 somente quando todos os checks passam", async () => { const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get("x-request-id")).toBe("request-ready-123"); expect((await response.json()).status).toBe("ready"); });
});
