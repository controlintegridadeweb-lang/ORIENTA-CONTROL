// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InstitutionalFooter } from "./institutional-footer";

vi.mock("next/image", () => ({
  default: function MockImage({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) {
    return <span role="img" aria-label={alt} data-src={src} />;
  },
}));

describe("InstitutionalFooter", () => {
  it("identifica a CGE e o Setor de Integridade", () => {
    render(<InstitutionalFooter />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Setor de Integridade");
    expect(footer.textContent).toContain(String(new Date().getFullYear()));
    expect(
      screen.getByRole("img", {
        name: "Controladoria-Geral do Estado do Rio Grande do Norte",
      }),
    ).not.toBeNull();
  });
});
