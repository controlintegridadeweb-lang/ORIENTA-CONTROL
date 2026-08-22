import { describe, expect, it, vi } from "vitest";
vi.mock("@/infrastructure/health/build-information", () => ({ getBuildInformation: () => ({ service: "orienta", version: "1.0.0-rc.1", commit: "abc123def456", environment: "test" }) }));
import { GET } from "./route";
describe("GET /api/health/live", () => {
  it("retorna liveness sem cache e com versão do deploy", async () => {
    const response = GET(new Request("https://orienta.test/api/health/live", { headers: { "x-request-id": "request-live-123" } }));
    const payload = await response.json(); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toBe("request-live-123"); expect(response.headers.get("x-orienta-release")).toBe("abc123def456"); expect(payload).toMatchObject({ status: "ok", service: "orienta" });
  });
});
