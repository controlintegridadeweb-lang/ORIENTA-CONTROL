// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Eye, Pencil } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionPlanRowOptionsMenu,
  actionPlanRowMenuFixedStyle,
  type ActionPlanRowMenuItem,
} from "./action-plan-row-options-menu";

afterEach(() => {
  cleanup();
});

const ITEMS: ActionPlanRowMenuItem[] = [
  { key: "view", label: "Visualizar", icon: Eye, onSelect: vi.fn() },
  { key: "edit", label: "Dados", icon: Pencil, onSelect: vi.fn() },
  { key: "progress", label: "Andamento", icon: Pencil, onSelect: vi.fn() },
  { key: "deadline", label: "Solicitar final", icon: Pencil, onSelect: vi.fn() },
  { key: "evidence", label: "Comprovantes", icon: Pencil, onSelect: vi.fn() },
  { key: "cancel", label: "Cancelar", icon: Pencil, onSelect: vi.fn() },
  { key: "delete", label: "Remover", icon: Pencil, tone: "danger", onSelect: vi.fn() },
];

function anchor(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 900,
    right: 1000,
    width: 100,
    height: bottom - top,
    x: 900,
    y: top,
    toJSON: () => "",
  };
}

describe("ActionPlanRowOptionsMenu", () => {
  it("mostra todas as opções fora do ancestral com overflow", () => {
    render(
      <div style={{ overflow: "hidden", height: 40 }}>
        <ActionPlanRowOptionsMenu actionLabel="Publicar calendário" items={ITEMS} />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Opções da ação/ }));

    for (const item of ITEMS) {
      expect(screen.getByRole("menuitem", { name: item.label })).toBeTruthy();
    }
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu?.parentElement).toBe(document.body);
  });

  it("abre para cima quando a lista não cabe abaixo do botão", () => {
    const style = actionPlanRowMenuFixedStyle(anchor(720, 752), ITEMS.length, {
      innerWidth: 1280,
      innerHeight: 800,
    });

    expect(style.bottom).toBe(800 - 720 + 6);
    expect(style.top).toBeUndefined();
    expect(style.position).toBe("fixed");
  });

  it("abre para baixo quando há espaço na viewport", () => {
    const style = actionPlanRowMenuFixedStyle(anchor(120, 152), ITEMS.length, {
      innerWidth: 1280,
      innerHeight: 800,
    });

    expect(style.top).toBe(152 + 6);
    expect(style.bottom).toBeUndefined();
    expect(style.overflowY).toBe("visible");
  });
});
