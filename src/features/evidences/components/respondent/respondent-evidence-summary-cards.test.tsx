// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RespondentEvidenceSummaryCards } from "./respondent-evidence-summary-cards";

describe("RespondentEvidenceSummaryCards", () => {
  afterEach(() => cleanup());

  it("não exibe indicadores zerados quando a leitura não produziu dados", () => {
    const { container } = render(
      <RespondentEvidenceSummaryCards
        stats={null}
        loading={false}
        activeKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(container.textContent).toBe("");
    expect(screen.queryByText("Enviadas")).toBeNull();
  });

  it("não renderiza o cartão redundante de total enviado", () => {
    render(
      <RespondentEvidenceSummaryCards
        stats={{ enviadas: 12, aprovadas: 4, aguardando: 3, reprovadas: 2, complementacao: 3, overall: "action_required", hasPendency: true }}
        loading={false}
        activeKey={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText("Enviadas")).toBeNull();
    expect(screen.getByText("Aprovadas")).toBeTruthy();
    expect(screen.getByText("Aguardando validação")).toBeTruthy();
  });
});
