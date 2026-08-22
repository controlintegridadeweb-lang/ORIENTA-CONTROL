// @vitest-environment jsdom

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationDetailHeader } from "./recommendation-detail-header";

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
  usePathname: () => "/respondente/plano-acao/11111111-1111-4111-8111-111111111111/visao-geral",
  useSearchParams: () => new URLSearchParams("returnTo=/respondente/portfolio-recomendacoes"),
}));

vi.mock("./recommendation-detail-context", () => ({
  useRecommendationDetailContext: () => ({
    role: "respondent",
    listPath: "/respondente/portfolio-recomendacoes",
    detailBasePath: "/respondente/plano-acao/11111111-1111-4111-8111-111111111111",
    workspaceSurface: "operational",
    respondentItem: {
      recommendationId: "11111111-1111-4111-8111-111111111111",
      recommendationText:
        "Texto longo da recomendação que não deve aparecer como título da página.",
      status: "generated",
      axisName: "Governança",
      sectionName: "Transparência",
      formName: "Diagnóstico",
    },
    adminItem: null,
  }),
}));

describe("RecommendationDetailHeader", () => {
  it("usa título fixo e não repete o texto da recomendação no H1", () => {
    render(<RecommendationDetailHeader />);
    expect(screen.getByRole("heading", { level: 1, name: "Detalhes da recomendação" })).toBeTruthy();
    const heading = screen.getByRole("heading", { level: 1, name: "Detalhes da recomendação" });
    const badge = screen.getByText("Gerada");
    expect(heading.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.queryByText(/Texto longo da recomendação que não deve aparecer/),
    ).toBeNull();
    expect(screen.getByRole("link", { name: /Voltar a Recomendações/i })).toBeTruthy();
  });
});
