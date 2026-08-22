// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidencesFilters } from "./evidences-filters";

const emptyValue = {
  cycleId: "",
  questionId: "",
  evidenceId: "",
  formId: "",
  organizationId: "",
  status: "" as const,
  search: "",
  from: "",
  to: "",
};

describe("EvidencesFilters", () => {
  afterEach(() => cleanup());

  it("não oferece Aguardando envio nem Não exigida no filtro de situação", () => {
    render(
      <EvidencesFilters
        options={{ forms: [], organizations: [] }}
        value={emptyValue}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const statusSelect = screen.getByLabelText("Situação");
    const labels = Array.from(statusSelect.querySelectorAll("option")).map(
      (option) => option.textContent,
    );

    expect(labels).toContain("Aguardando validação");
    expect(labels).toContain("Ajuste solicitado");
    expect(labels).toContain("Aprovada");
    expect(labels).toContain("Não aprovada");
    expect(labels.some((label) => label?.includes("Aguardando envio"))).toBe(
      false,
    );
    expect(labels).not.toContain("Não exigida");
  });
});
