import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rejectCrossSiteMutation } from "./csrf";

function request(input: {
  method?: string;
  origin?: string;
  authorization?: string;
  fetchSite?: string;
  url?: string;
}) {
  const headers = new Headers();
  if (input.origin) headers.set("origin", input.origin);
  if (input.authorization) headers.set("authorization", input.authorization);
  if (input.fetchSite) headers.set("sec-fetch-site", input.fetchSite);
  return new Request(input.url ?? "https://orienta.example/api/cycles", {
    method: input.method ?? "POST",
    headers,
  });
}

const TRUSTED_ORIGIN_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

beforeEach(() => {
  for (const key of TRUSTED_ORIGIN_ENV) delete process.env[key];
});

afterEach(() => {
  for (const key of TRUSTED_ORIGIN_ENV) delete process.env[key];
});

describe("rejectCrossSiteMutation", () => {
  it("ignora métodos seguros", () => {
    expect(rejectCrossSiteMutation(request({ method: "GET" }))).toBeNull();
  });

  it("permite cliente autenticado por Bearer sem Origin", () => {
    expect(
      rejectCrossSiteMutation(request({ authorization: "Bearer token" })),
    ).toBeNull();
  });

  it("permite mutação por cookie somente com Origin exato", () => {
    expect(
      rejectCrossSiteMutation(
        request({ origin: "https://orienta.example", fetchSite: "same-origin" }),
      ),
    ).toBeNull();
  });

  it("rejeita mutação por cookie sem Origin", () => {
    expect(rejectCrossSiteMutation(request({}))?.status).toBe(403);
  });

  it("rejeita Origin diferente", () => {
    expect(
      rejectCrossSiteMutation(
        request({ origin: "https://attacker.example", fetchSite: "cross-site" }),
      )?.status,
    ).toBe(403);
  });

  it("aceita a origem de preview fornecida pelo ambiente da Vercel", () => {
    process.env.VERCEL_URL = "orienta-preview.vercel.app";
    expect(
      rejectCrossSiteMutation(
        request({
          url: "http://internal:3000/api/cycles",
          origin: "https://orienta-preview.vercel.app",
          fetchSite: "same-origin",
        }),
      ),
    ).toBeNull();
  });

  it("aceita o Origin canônico configurado atrás de proxy", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://orienta.example";
    const result = rejectCrossSiteMutation(
      request({
        url: "http://internal:3000/api/cycles",
        origin: "https://orienta.example",
        fetchSite: "same-origin",
      }),
    );
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(result).toBeNull();
  });

  it("aceita same-origin real mesmo com APP_URL apontando para outro host local", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3002";
    expect(
      rejectCrossSiteMutation(
        request({
          url: "http://127.0.0.1:3002/api/auth/sign-in",
          origin: "http://127.0.0.1:3002",
          fetchSite: "same-origin",
        }),
      ),
    ).toBeNull();
  });

  it("continua rejeitando Origin externo com APP_URL configurada", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3002";
    expect(
      rejectCrossSiteMutation(
        request({
          url: "http://localhost:3002/api/auth/sign-in",
          origin: "https://attacker.example",
          fetchSite: "cross-site",
        }),
      )?.status,
    ).toBe(403);
  });
});
