// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationAccessChart } from "./organization-access-chart";

afterEach(() => {
  cleanup();
});

describe("organograma de acesso do órgão", () => {
  it("mostra titular, suplente e marca a pessoa logada", () => {
    render(
      <OrganizationAccessChart
        organizationName="Secretaria de Turismo"
        currentUserId="ana"
        members={[
          {
            userId: "ana",
            fullName: "Ana Carolina",
            email: "ana@setur.rn.gov.br",
            appointment: "titular",
          },
          {
            userId: "joao",
            fullName: "João Souza",
            email: "joao@setur.rn.gov.br",
            appointment: "suplente",
          },
        ]}
      />,
    );

    expect(screen.getByText("Secretaria de Turismo")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Titular" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Suplente" })).toBeTruthy();
    expect(screen.getByText("Ana Carolina")).toBeTruthy();
    expect(screen.getByText("Você")).toBeTruthy();
    expect(screen.getByText("João Souza")).toBeTruthy();
    expect(screen.queryByText("Nenhum titular cadastrado.")).toBeNull();
  });

  it("não mostra coluna vazia nem pessoa sem cargo definido", () => {
    render(
      <OrganizationAccessChart
        organizationName="SETUR"
        currentUserId="ana"
        members={[
          {
            userId: "ana",
            fullName: "Ana Carolina",
            email: null,
            appointment: "titular",
          },
          {
            userId: "sem-cargo",
            fullName: "Pessoa sem cargo",
            email: "semcargo@org.gov.br",
            appointment: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Titular" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Suplente" })).toBeNull();
    expect(screen.queryByText("Pessoa sem cargo")).toBeNull();
    expect(screen.queryByText("Cargo ainda não definido")).toBeNull();
  });
});
