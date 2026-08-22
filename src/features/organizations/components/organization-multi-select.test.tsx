// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationMultiSelect } from "./organization-multi-select";

const options = [
  { id: "1", label: "Alfa" },
  { id: "2", label: "Beta" },
  { id: "3", label: "Gama" },
];

function ControlledSelector() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <OrganizationMultiSelect
      options={options}
      selectedIds={selected}
      onChange={setSelected}
      pageSize={2}
    />
  );
}

describe("OrganizationMultiSelect", () => {
  afterEach(cleanup);

  it("busca por nome e informa a seleção global", () => {
    render(<ControlledSelector />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar organização" }), {
      target: { value: "beta" },
    });
    expect(screen.getByText("Beta")).not.toBeNull();
    expect(screen.queryByText("Alfa")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Selecionar todas, inclusive de outras páginas/i }));
    expect(screen.getByText((_content, node) => node?.tagName === "P" && node.textContent?.includes("3 de 3 organizações selecionadas") === true)).not.toBeNull();
  });

  it("preserva organizações bloqueadas ao limpar a seleção", () => {
    function WithLocked() {
      const [selected, setSelected] = useState<Set<string>>(new Set(["1", "2"]));
      return (
        <OrganizationMultiSelect
          options={[{ ...options[0], locked: true }, options[1]]}
          selectedIds={selected}
          onChange={setSelected}
        />
      );
    }

    render(<WithLocked />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect((screen.getByRole("checkbox", { name: /^Alfa/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Beta" }) as HTMLInputElement).checked).toBe(false);
  });

  it("coloca paginação e ação de rodapé no mesmo footer sem caixas extras", () => {
    render(
      <OrganizationMultiSelect
        options={options}
        selectedIds={new Set()}
        onChange={() => undefined}
        pageSize={2}
        footerActions={<button type="button">Salvar seleção</button>}
      />,
    );

    const footer = screen.getByRole("button", { name: "Salvar seleção" }).closest("footer");
    expect(footer).not.toBeNull();
    expect(footer?.querySelector('[aria-label="Paginação"]')).not.toBeNull();
  });
});
