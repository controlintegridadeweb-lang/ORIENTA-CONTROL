import { describe, expect, it } from "vitest";
import { cycleStateFromRpcMessage } from "../rpc-cycle-state";

describe("cycleStateFromRpcMessage", () => {
  it("extrai estados compostos por sublinhado", () => {
    expect(cycleStateFromRpcMessage("Operação inválida: estado do ciclo awaiting_adjustment")).toBe(
      "awaiting_adjustment",
    );
  });

  it("retorna nulo quando a mensagem não informa o estado", () => {
    expect(cycleStateFromRpcMessage("cycle_not_found")).toBeNull();
  });
});
