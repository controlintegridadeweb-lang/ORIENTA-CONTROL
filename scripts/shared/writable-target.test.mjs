import { describe, expect, it } from "vitest";
import {
  assertResetConfirmation,
  assertWritableTarget,
  projectRefFromDatabaseUrl,
  projectRefFromSupabaseUrl,
} from "./writable-target.mjs";

const homologacaoRef = "abcdefghij0123456789";
const productionRef = "zyxwvutsrq9876543210";

function homologacaoEnv(overrides = {}) {
  return {
    ORIENTA_TARGET: "homologacao",
    ORIENTA_HOMOLOGACAO_PROJECT_REF: homologacaoRef,
    ORIENTA_PRODUCTION_PROJECT_REF: productionRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${homologacaoRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-homologacao",
    SUPABASE_SERVICE_ROLE_KEY: "service-homologacao",
    DATABASE_URL: `postgresql://postgres.${homologacaoRef}:secret@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3003",
    ...overrides,
  };
}

describe("destino gravável", () => {
  it("identifica o projeto no pooler pelo usuário, não pelo hostname compartilhado", () => {
    expect(
      projectRefFromDatabaseUrl(
        `postgresql://postgres.${homologacaoRef}:secret@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`,
      ),
    ).toBe(homologacaoRef);
  });

  it("identifica o projeto no host direto do banco", () => {
    expect(
      projectRefFromDatabaseUrl(
        `postgresql://postgres:secret@db.${homologacaoRef}.supabase.co:5432/postgres`,
      ),
    ).toBe(homologacaoRef);
    expect(projectRefFromSupabaseUrl(`https://${homologacaoRef}.supabase.co`)).toBe(homologacaoRef);
  });

  it("recusa pooler sem o ref no usuário", () => {
    expect(() =>
      projectRefFromDatabaseUrl(
        "postgresql://postgres:secret@aws-1-sa-east-1.pooler.supabase.com:5432/postgres",
      ),
    ).toThrow(/não identifica o projeto/);
  });

  it("aceita homologação quando URL e Postgres apontam para o mesmo ref, diferente do oficial", () => {
    expect(assertWritableTarget(homologacaoEnv()).projectRef).toBe(homologacaoRef);
  });

  it("bloqueia alvo ausente, oficial e tentativa de desligar a proteção", () => {
    expect(() => assertWritableTarget({})).toThrow(/Produção não é destino/);
    expect(() => assertWritableTarget(homologacaoEnv({ ORIENTA_TARGET: "producao" }))).toThrow(
      /Produção não é destino/,
    );
    expect(() =>
      assertWritableTarget(homologacaoEnv({ ORIENTA_SKIP_TARGET_CHECK: "1" })),
    ).toThrow(/não pode ser desativada/);
  });

  it("bloqueia configuração incompleta, ref divergente e o projeto oficial", () => {
    expect(() => assertWritableTarget(homologacaoEnv({ DATABASE_URL: "" }))).toThrow(
      /Postgres de homologação está ausente/,
    );
    expect(() =>
      assertWritableTarget(
        homologacaoEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
        }),
      ),
    ).toThrow(/não corresponde/);
    expect(() =>
      assertWritableTarget(
        homologacaoEnv({
          ORIENTA_PRODUCTION_PROJECT_REF: homologacaoRef,
          NEXT_PUBLIC_SUPABASE_URL: `https://${homologacaoRef}.supabase.co`,
        }),
      ),
    ).toThrow(/mesmo projeto declarado como oficial/);
  });

  it("bloqueia quando o Postgres do pooler é o projeto oficial", () => {
    expect(() =>
      assertWritableTarget(
        homologacaoEnv({
          DATABASE_URL: `postgresql://postgres.${productionRef}:secret@aws-1-sa-east-1.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toThrow(/não corresponde/);
  });

  it("bloqueia homologação quando o .env.local isolado é o mesmo projeto", () => {
    expect(() =>
      assertWritableTarget(homologacaoEnv(), {
        productionEnv: {
          NEXT_PUBLIC_SUPABASE_URL: `https://${homologacaoRef}.supabase.co`,
        },
      }),
    ).toThrow(/mesmo projeto da homologação/);
  });

  it("exige confirmação adicional para operação destrutiva", () => {
    expect(() => assertWritableTarget(homologacaoEnv(), { destructive: true })).toThrow(
      /Operação destrutiva bloqueada/,
    );
    expect(
      assertWritableTarget(
        homologacaoEnv({ ORIENTA_HOMOLOGACAO_CONFIRM: `aplicar-homologacao:${homologacaoRef}` }),
        { destructive: true },
      ).projectRef,
    ).toBe(homologacaoRef);
  });

  it("aceita somente o Postgres local na porta 54322 quando o alvo é local", () => {
    expect(
      assertWritableTarget({
        ORIENTA_TARGET: "local",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }).target,
    ).toBe("local");
    expect(() =>
      assertWritableTarget({
        ORIENTA_TARGET: "local",
        DATABASE_URL: `postgresql://postgres.${productionRef}:secret@db.${productionRef}.supabase.co:5432/postgres`,
      }),
    ).toThrow(/não está em localhost/);
  });

  it("exige a confirmação exata do reset", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co` };
    expect(() => assertResetConfirmation(env)).toThrow(new RegExp(`reset:${productionRef}`));
    expect(
      assertResetConfirmation({ ...env, ORIENTA_RESET_CONFIRM: `reset:${productionRef}` }),
    ).toBe(productionRef);
  });

  it("mantém os e-mails fictícios iguais aos da jornada", async () => {
    const { readFileSync } = await import("node:fs");
    const fixture = readFileSync("e2e/fixtures/orienta.ts", "utf8");
    const seed = readFileSync("scripts/testing/seed-homologacao.mjs", "utf8");
    for (const email of [
      "admin.e2e@orienta.local",
      "respondente.e2e@orienta.local",
      "respondente.externo.e2e@orienta.local",
    ]) {
      expect(fixture).toContain(email);
      expect(seed).toContain(email);
    }
    expect(seed).toContain("suplente.alfa@orienta.test");
    expect(seed).toContain("suplente.beta@orienta.test");
    expect(seed).toContain('"titular"');
    expect(seed).toContain('"suplente"');
  });
});
