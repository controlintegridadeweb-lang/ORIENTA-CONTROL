// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ExportMenu, exportMenuFixedStyle, type ExportMenuOption } from "./export-menu";

const OPTIONS: Array<ExportMenuOption<"csv" | "xlsx" | "pdf">> = [
  { format: "csv", label: "Exportar CSV", icon: Table2, hint: "Tabela." },
  { format: "xlsx", label: "Exportar Excel", icon: FileSpreadsheet, hint: "Planilha." },
  { format: "pdf", label: "Exportar PDF", icon: FileText, hint: "Relatório." },
];

describe("ExportMenu", () => {
  it("mostra CSV, Excel e PDF ao abrir, mesmo com ancestral de overflow", () => {
    render(
      <div style={{ overflow: "hidden", height: 48 }}>
        <ExportMenu options={OPTIONS} onExport={vi.fn()} />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    expect(screen.getByRole("menuitem", { name: /Exportar CSV/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Exportar Excel/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Exportar PDF/ })).toBeTruthy();
    expect(document.body.querySelector('[role="menu"]')).toBeTruthy();
  });

  it("abre para cima quando não há espaço abaixo do botão", () => {
    const style = exportMenuFixedStyle(
      { top: 700, bottom: 732, left: 400, right: 520, width: 120, height: 32, x: 400, y: 700, toJSON: () => "" },
      { innerWidth: 1280, innerHeight: 800 },
    );
    expect(style.bottom).toBe(800 - 700 + 8);
    expect(style.top).toBeUndefined();
  });
});
