// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

const notification = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Evidência revisada",
  message: "A evidência recebeu uma decisão.",
  action_path: null,
  visible_at: "2026-07-17T20:00:00.000Z",
  read_at: null,
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe("NotificationBell", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("informa a quantidade, fecha com Escape e devolve o foco ao sino", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        jsonResponse({ notifications: [notification], unreadCount: 1 }),
      ),
    );

    render(<NotificationBell />);
    const bell = await screen.findByRole("button", { name: "Notificações, 1 não lida" });
    fireEvent.click(bell);
    expect(await screen.findByRole("dialog", { name: "Notificações" })).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(bell);
  });

  it("mantém visível a falha ao marcar uma notificação como lida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return jsonResponse({}, false);
        return jsonResponse({ notifications: [notification], unreadCount: 1 });
      }),
    );

    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lida" }));
    fireEvent.click(await screen.findByRole("button", { name: /Evidência revisada/i }));

    expect(await screen.findByText("Não foi possível marcar a notificação como lida.")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).not.toBeNull();
  });

  it("trata rejeição de rede ao marcar uma notificação sem deixar promise solta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return Promise.reject(new TypeError("offline"));
        return jsonResponse({ notifications: [notification], unreadCount: 1 });
      }),
    );

    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lida" }));
    fireEvent.click(await screen.findByRole("button", { name: /Evidência revisada/i }));

    expect(await screen.findByText("Não foi possível marcar a notificação como lida.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Notificações, 1 não lida" })).not.toBeNull();
  });

  it("preserva o contador quando a rede falha ao marcar todas como lidas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return Promise.reject(new TypeError("offline"));
        return jsonResponse({ notifications: [notification], unreadCount: 1 });
      }),
    );

    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificações, 1 não lida" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar todas como lidas" }));

    expect(
      await screen.findByText("Não foi possível marcar todas as notificações como lidas."),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "Notificações, 1 não lida" })).not.toBeNull();
  });
});
