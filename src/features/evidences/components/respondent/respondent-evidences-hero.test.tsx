// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RespondentEvidencesHero } from "./respondent-evidences-hero";

vi.mock("next/image", () => ({
  default: (props: { alt: string }) => <span role="img" aria-label={props.alt} />,
}));

describe("RespondentEvidencesHero", () => {
  afterEach(() => cleanup());

  it("oferece a exportação da planilha junto das outras ações", () => {
    const onExport = vi.fn();
    render(
      <RespondentEvidencesHero
        onRefresh={vi.fn()}
        refreshing={false}
        onExport={onExport}
        exporting={false}
      />,
    );

    screen.getByRole("button", { name: "Exportar planilha" }).click();
    expect(onExport).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Ir para diagnósticos/ })).toBeTruthy();
  });

  it("não dispara a exportação enquanto a tela atualiza", () => {
    const onExport = vi.fn();
    render(
      <RespondentEvidencesHero
        onRefresh={vi.fn()}
        refreshing
        onExport={onExport}
        exporting={false}
      />,
    );

    const button = screen.getByRole("button", { name: "Exportar planilha" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});
