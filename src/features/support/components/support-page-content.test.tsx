// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupportPageContent } from "./support-page-content";

describe("SupportPageContent", () => {
  afterEach(() => cleanup());

  it("mostra somente e-mail e WhatsApp", () => {
    render(<SupportPageContent role="admin" />);

    expect(screen.getByRole("heading", { name: "Suporte" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /integridadecge@gmail\.com/ }).getAttribute("href")).toBe(
      "mailto:integridadecge@gmail.com",
    );
    expect(screen.getByText("(84) 9 8620-0805")).toBeTruthy();
    expect(screen.queryByText("control@rn.gov.br")).toBeNull();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull();
  });

  it("repete os mesmos canais para o respondente", () => {
    render(<SupportPageContent role="respondent" />);

    expect(screen.getByText("integridadecge@gmail.com")).toBeTruthy();
    expect(screen.getByText("(84) 9 8620-0805")).toBeTruthy();
  });
});
