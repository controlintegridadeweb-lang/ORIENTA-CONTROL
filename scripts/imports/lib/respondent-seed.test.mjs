import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  credentialPasswordResolver,
  emailDeliveryWarning,
  generateTemporaryPassword,
  isWeakPassword,
  parseRespondentCredentials,
  parseRespondentSeed,
  resolvePasswordFactory,
  serializeCredentials,
} from "./respondent-seed.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const seedFile = resolve(here, "../../../supabase/seeds/respondent_accounts.csv");

describe("respondent account seed", () => {
  it("carrega as contas mínimas fictícias sem senha ou dados pessoais versionados", () => {
    const csv = readFileSync(seedFile, "utf8");
    const rows = parseRespondentSeed(csv);

    expect(rows).toHaveLength(2);
    expect(csv.toLowerCase()).not.toContain("temporary_password");
    expect(csv.split("\n")[0]).toBe(
      "organization_name,organization_acronym,email,full_name,appointment",
    );
    expect(rows.every((row) => row.email.endsWith("@example.invalid"))).toBe(true);
    expect(rows.every((row) => /^Respondente de Desenvolvimento [A-B]$/.test(row.fullName))).toBe(true);
  });

  it("mantém todos os e-mails sem alertas estruturais conhecidos", () => {
    const rows = parseRespondentSeed(readFileSync(seedFile, "utf8"));
    const warnings = rows.filter((row) => emailDeliveryWarning(row.email));
    expect(warnings).toHaveLength(0);
  });

  it("sinaliza e-mail institucional provisório em provedor público", () => {
    expect(emailDeliveryWarning("orgao@gmail.com")).toMatch(/confirme a titularidade/i);
    expect(emailDeliveryWarning("usuario@orgao.rn.gov.br")).toBeNull();
  });

  it("recusa duplicidade de e-mail", () => {
    const csv = [
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,,titular",
      "Órgão B,OB,a@example.com,,suplente",
    ].join("\n");
    expect(() => parseRespondentSeed(csv)).toThrow(/e-mail duplicado/);
  });

  it("aceita várias pessoas na mesma organização", () => {
    const rows = parseRespondentSeed([
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,Pessoa A,titular",
      "Órgão A,OA,b@example.com,Pessoa B,suplente",
    ].join("\n"));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.organizationAcronym)).toEqual(["OA", "OA"]);
    expect(rows.map((row) => row.email)).toEqual(["a@example.com", "b@example.com"]);
    expect(rows.map((row) => row.appointment)).toEqual(["titular", "suplente"]);
  });

  it("recusa cargo fora de titular ou suplente", () => {
    const csv = [
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,Pessoa A,coordenador",
    ].join("\n");
    expect(() => parseRespondentSeed(csv)).toThrow(/titular ou suplente/);
  });

  it("gera senha temporária forte e não determinística", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(20);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/\d/);
    expect(first).toMatch(/[^A-Za-z0-9]/);
    expect(isWeakPassword(first)).toBe(false);
  });


  it("carrega senhas exatas somente quando todas correspondem à fonte", () => {
    const respondents = parseRespondentSeed([
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,Respondente A,titular",
      "Órgão B,OB,b@example.com,Respondente B,suplente",
    ].join("\n"));
    const credentials = parseRespondentCredentials([
      "organization_acronym,email,temporary_password",
      "OA,a@example.com,SenhaA!123456",
      "OB,b@example.com,SenhaB!123456",
    ].join("\n"));

    const resolve = credentialPasswordResolver(credentials, respondents);
    expect(resolve(respondents[0])).toBe("SenhaA!123456");
    expect(resolve(respondents[1])).toBe("SenhaB!123456");
  });

  it("aceita credenciais de várias pessoas da mesma organização", () => {
    const respondents = parseRespondentSeed([
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,Pessoa A,titular",
      "Órgão A,OA,b@example.com,Pessoa B,suplente",
    ].join("\n"));
    const credentials = parseRespondentCredentials([
      "organization_acronym,email,temporary_password",
      "OA,a@example.com,SenhaA!123456",
      "OA,b@example.com,SenhaB!123456",
    ].join("\n"));

    const resolve = credentialPasswordResolver(credentials, respondents);
    expect(resolve(respondents[0])).toBe("SenhaA!123456");
    expect(resolve(respondents[1])).toBe("SenhaB!123456");
  });

  it("recusa credencial fraca ou sem correspondência", () => {
    expect(() => parseRespondentCredentials([
      "organization_acronym,email,temporary_password",
      "OA,a@example.com,senha-fraca",
    ].join("\n"))).toThrow(/maiúscula, minúscula, número e símbolo/i);

    const respondents = parseRespondentSeed([
      "organization_name,organization_acronym,email,full_name,appointment",
      "Órgão A,OA,a@example.com,Respondente A,titular",
    ].join("\n"));
    const credentials = parseRespondentCredentials([
      "organization_acronym,email,temporary_password",
      "OB,b@example.com,SenhaB!123456",
    ].join("\n"));
    expect(() => credentialPasswordResolver(credentials, respondents)).toThrow(/Credencial ausente/);
  });

  it("recusa senha fixa fraca sem opção de bypass", () => {
    expect(() => resolvePasswordFactory({
      mode: "fixed",
      fixedPassword: "senha-fraca",
    })).toThrow(/ao menos 12|política de segurança|maiúscula|símbolo/i);
  });

  it("serializa credenciais com escape CSV", () => {
    const csv = serializeCredentials([{
      organizationAcronym: "ORG",
      email: "respondente@example.com",
      password: 'Senha,"temporária"',
      operation: "created",
    }]);
    expect(csv).toContain('"Senha,""temporária"""');
  });
});
