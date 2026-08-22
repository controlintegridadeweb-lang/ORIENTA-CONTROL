import { afterEach, describe, expect, it, vi } from "vitest";
import { isReadinessRequestAuthorized } from "./health-authorization";

const originalSecret = process.env.HEALTHCHECK_SECRET;

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalSecret === undefined) delete process.env.HEALTHCHECK_SECRET;
  else process.env.HEALTHCHECK_SECRET = originalSecret;
});

describe("isReadinessRequestAuthorized", () => {
  it("exige segredo em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.HEALTHCHECK_SECRET =
      "segredo-de-health-check-com-mais-de-32-caracteres";
    expect(
      isReadinessRequestAuthorized(new Request("https://orienta.test")),
    ).toBe(false);
  });

  it("aceita Bearer válido", () => {
    vi.stubEnv("NODE_ENV", "production");
    const secret = "segredo-de-health-check-com-mais-de-32-caracteres";
    process.env.HEALTHCHECK_SECRET = secret;
    expect(
      isReadinessRequestAuthorized(
        new Request("https://orienta.test", {
          headers: { authorization: `Bearer ${secret}` },
        }),
      ),
    ).toBe(true);
  });
});
