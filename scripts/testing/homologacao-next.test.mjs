import { describe, expect, it } from "vitest";
import { childEnvForHomologacaoNext } from "./homologacao-next.mjs";

describe("childEnvForHomologacaoNext", () => {
  it("mantém a homologação e bloqueia segredo que só existe no .env.local", () => {
    const env = childEnvForHomologacaoNext(
      { NEXT_PUBLIC_SUPABASE_URL: "https://homologacao.supabase.co" },
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://homologacao.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-homologacao",
      },
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://oficial.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-oficial",
        SUPABASE_ACCESS_TOKEN: "token-oficial",
      },
    );

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://homologacao.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("anon-homologacao");
    expect(env.SUPABASE_ACCESS_TOKEN).toBe("");
  });

  it("recusa valor de homologação igual ao do .env.local", () => {
    expect(() =>
      childEnvForHomologacaoNext(
        {},
        { SUPABASE_SERVICE_ROLE_KEY: "mesmo-valor" },
        { SUPABASE_SERVICE_ROLE_KEY: "mesmo-valor" },
      ),
    ).toThrow(/repete o valor do \.env\.local/);
  });
});
