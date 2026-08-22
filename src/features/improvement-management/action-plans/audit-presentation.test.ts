import { describe, expect, it } from "vitest";
import type { ActionPlanAuditEntry } from "./types";
import { parseActionPlanAuditEntry } from "./audit-presentation";

function makeEntry(overrides: Partial<ActionPlanAuditEntry>): ActionPlanAuditEntry {
  return {
    id: "audit-1",
    eventType: "update",
    createdAt: "2026-07-11T18:00:00.000Z",
    actorId: "user-1",
    oldValue: {},
    newValue: {},
    ...overrides,
  };
}

describe("parseActionPlanAuditEntry", () => {
  it("reconhece alteração no responsável persistido em responsible_label", () => {
    const event = parseActionPlanAuditEntry(
      makeEntry({
        oldValue: { responsible_label: "Planejamento — Ana" },
        newValue: { responsible_label: "Tecnologia — Bruno" },
      }),
    );

    expect(event.label).toBe("Responsável atualizado");
    expect(event.description).toBe("Tecnologia — Bruno");
  });

  it("reconhece atualização das observações operacionais separadas da supervisão", () => {
    const event = parseActionPlanAuditEntry(
      makeEntry({
        oldValue: { execution_notes: "Aguardando documentos" },
        newValue: { execution_notes: "Documentos recebidos" },
      }),
    );

    expect(event.label).toBe("Observações da execução atualizadas");
    expect(event.description).toBe("Documentos recebidos");
  });

  it("traduz eventos técnicos INSERT e UPDATE para português", () => {
    const created = parseActionPlanAuditEntry(
      makeEntry({
        eventType: "INSERT",
        oldValue: null,
        newValue: { action_text: "Implantar controle" },
      }),
    );
    expect(created.label).toBe("Ação criada");

    const updated = parseActionPlanAuditEntry(
      makeEntry({
        eventType: "UPDATE",
        oldValue: { status: "todo", action_text: "A" },
        newValue: { status: "done", action_text: "A" },
      }),
    );
    expect(updated.label).toBe("Ação concluída");
  });
});
