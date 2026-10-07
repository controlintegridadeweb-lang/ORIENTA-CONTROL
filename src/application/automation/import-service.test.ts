import { describe, expect, it } from "vitest";
import {
  previewCsvImport,
  respondentImportAccessMessage,
} from "./import-service";

describe("previewCsvImport", () => {
  it("valida organizações e detecta duplicidade no próprio arquivo", () => {
    const result = previewCsvImport(
      "organizations",
      "nome;sigla\nSecretaria de Teste;SET\nOutra Secretaria;SET",
    );

    expect(result.validCount).toBe(1);
    expect(result.results[1]).toMatchObject({ status: "failed", row: 3 });
  });

  it("aceita campos entre aspas e rejeita aspas sem fechamento", () => {
    const valid = previewCsvImport(
      "organizations",
      'nome;sigla\n"Secretaria, Especial";SEE',
    );
    expect(valid.validCount).toBe(1);

    expect(() =>
      previewCsvImport("organizations", 'nome;sigla\n"Secretaria;SEE'),
    ).toThrow("sem fechamento");
  });

  it("aceita várias pessoas na mesma organização", () => {
    const result = previewCsvImport(
      "respondents",
      "email;nome;sigla_org;cargo\numa@org.gov.br;Uma Pessoa;SEEX;titular\noutra@org.gov.br;Outra Pessoa;SEEX;suplente",
    );

    expect(result.validCount).toBe(2);
    expect(result.results.every((row) => row.status === "valid")).toBe(true);
    expect(result.rows.map((row) => row.appointment)).toEqual(["titular", "suplente"]);
  });

  it("exige cargo titular ou suplente", () => {
    const result = previewCsvImport(
      "respondents",
      "email;nome;sigla_org;cargo\numa@org.gov.br;Uma Pessoa;SEEX;",
    );

    expect(result.results[0]?.status).toBe("failed");
    expect(result.results[0]?.message).toContain("titular ou suplente");
  });

  it("valida senha provisória antes da gravação", () => {
    const result = previewCsvImport(
      "respondents",
      "email;nome;sigla_org;senha_provisoria\nusuario@exemplo.gov.br;Usuário;SET;123",
    );
    expect(result.results[0]?.status).toBe("failed");
    expect(result.results[0]?.message).toContain("Não inclua senhas");
  });
});

describe("respondentImportAccessMessage", () => {
  it("confirma quando o provedor aceita a solicitação por e-mail", () => {
    expect(
      respondentImportAccessMessage({ accessMethod: "email", recoveryLink: null }),
    ).toContain("solicitação de definição de senha enviada");
  });

  it("informa quando existe apenas link alternativo", () => {
    const message = respondentImportAccessMessage({
      accessMethod: "recovery_link",
      recoveryLink: "https://app.exemplo/recovery",
    });
    expect(message).toContain("link alternativo disponível");
    expect(message).not.toContain("solicitação de definição de senha enviada");
  });

  it("reconhece a senha provisória como acesso válido", () => {
    expect(
      respondentImportAccessMessage({
        accessMethod: "temporary_password",
        recoveryLink: null,
      }),
    ).toContain("senha provisória");
  });
});
