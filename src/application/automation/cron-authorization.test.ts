import { afterEach, describe, expect, it } from "vitest";
import { authorizeCron } from "./cron-authorization";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

function request(value?: string) {
  return new Request("https://orienta.example/api/maintenance/jobs", {
    headers: value ? { authorization: value } : undefined,
  });
}

describe("authorizeCron", () => {
  it("falha fechado sem configuração", () => {
    expect(authorizeCron(request())?.status).toBe(503);
  });

  it("rejeita segredo ausente ou incorreto", () => {
    process.env.CRON_SECRET = "segredo-forte";
    expect(authorizeCron(request())?.status).toBe(401);
    expect(authorizeCron(request("Bearer incorreto"))?.status).toBe(401);
  });

  it("aceita somente o segredo exato", () => {
    process.env.CRON_SECRET = "segredo-forte";
    expect(authorizeCron(request("Bearer segredo-forte"))).toBeNull();
  });
});
