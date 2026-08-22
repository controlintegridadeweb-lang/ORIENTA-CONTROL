// @vitest-environment jsdom

import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecommendationNextStepSection } from "./recommendation-next-step-section";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./recommendation-detail-context", () => ({
  useRecommendationDetailContext: () => ({
    detailBasePath: "/respondente/plano-acao/11111111-1111-4111-8111-111111111111",
    role: "respondent",
    listPath: "/respondente/portfolio-recomendacoes",
    actionsTabHrefSegment: "acoes",
  }),
}));

describe("RecommendationNextStepSection", () => {
  it("oferece Cadastrar ação sem plano", () => {
    render(<RecommendationNextStepSection actionCount={0} axisName="Governança" />);
    const cta = screen.getByRole("link", { name: /Cadastrar ação/i });
    expect(cta.getAttribute("href")).toContain("/acoes");
    expect(cta.getAttribute("href")).toContain("new=1");
  });

  it("oferece Ir para plano de ação quando já há ações", () => {
    render(
      <RecommendationNextStepSection
        actionCount={2}
        axisName="Governança"
        highlightActionText="Publicar informações institucionais"
      />,
    );
    expect(screen.getByRole("link", { name: /Ir para plano de ação/i })).toBeTruthy();
    expect(screen.getByText(/Atualizar ação/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Cadastrar ação$/i })).toBeNull();
  });
});
