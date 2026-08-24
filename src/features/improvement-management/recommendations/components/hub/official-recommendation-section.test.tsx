// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfficialRecommendationSection } from "./official-recommendation-section";

const copyTextToClipboard = vi.fn();

vi.mock("@/shared/browser/clipboard", () => ({
  copyTextToClipboard: (...args: unknown[]) => copyTextToClipboard(...args),
}));

vi.mock("@/infrastructure/notifications/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  copyTextToClipboard.mockReset();
});

describe("OfficialRecommendationSection", () => {
  it("copia o texto exibido ao clicar em Copiar", async () => {
    copyTextToClipboard.mockResolvedValue(true);
    const { notify } = await import("@/infrastructure/notifications/notify");

    render(
      <OfficialRecommendationSection
        recommendationText="  Formalizar o acompanhamento institucional  "
        axisName="Governança"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith("Formalizar o acompanhamento institucional");
      expect(notify.success).toHaveBeenCalledWith("Texto copiado.");
    });
  });

  it("avisa quando a cópia falha", async () => {
    copyTextToClipboard.mockResolvedValue(false);
    const { notify } = await import("@/infrastructure/notifications/notify");

    render(
      <OfficialRecommendationSection recommendationText="Texto" axisName="Governança" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith("Não foi possível copiar.");
    });
  });
});
