import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canReopen,
  canTransition,
  isRespondentEditable,
  isCycleCompleted,
} from "@/shared/domain/workflow";
import type { CycleState } from "@/shared/domain/types";

/**
 * Fluxo completo com DOIS órgãos no MESMO formulário-template.
 *
 * O ponto central da arquitetura (0005_cycles): o estado pertence ao
 * CICLO (form × organização), não ao formulário. Logo, dois órgãos avançam de
 * forma independente — um pode estar em validação enquanto o outro é devolvido
 * para ajuste, e ambos coexistem no mesmo formulário.
 *
 * Este teste modela os ciclos como uma máquina de estados in-memory dirigida
 * pelas MESMAS funções de domínio usadas em produção (`canTransition`,
 * `canReopen`), garantindo que o fluxo descrito é realmente representável.
 */

class CycleModel {
  state: CycleState;
  reopenCount = 0;

  constructor(initial: CycleState = "in_response") {
    this.state = initial;
  }

  /** Transição validada pela máquina de estados real. */
  transition(to: CycleState): void {
    if (!canTransition(this.state, to)) {
      throw new Error(`Transição inválida: ${this.state} -> ${to}`);
    }
    this.state = to;
  }

  reopen(): void {
    if (!canReopen(this.state)) {
      throw new Error(`Transição inválida: ${this.state} -> in_response`);
    }
    this.state = "in_response";
    this.reopenCount += 1;
  }
}

describe("Fluxo de dois órgãos no mesmo formulário", () => {
  it("órgão A e órgão B respondem e avançam independentemente", () => {
    const orgA = new CycleModel("in_response");
    const orgB = new CycleModel("in_response");

    // Ambos podem editar enquanto em resposta.
    expect(isRespondentEditable(orgA.state)).toBe(true);
    expect(isRespondentEditable(orgB.state)).toBe(true);

    // A envia; B continua respondendo (estados independentes no mesmo form).
    orgA.transition("submitted");
    expect(orgA.state).toBe("submitted");
    expect(orgB.state).toBe("in_response");

    orgB.transition("submitted");
    expect(orgB.state).toBe("submitted");
  });

  it("admin valida o órgão A e devolve o órgão B para ajuste", () => {
    const orgA = new CycleModel("submitted");
    const orgB = new CycleModel("submitted");

    // Admin inicia validação dos dois.
    orgA.transition("in_validation");
    orgB.transition("in_validation");

    // A é consolidado (diagnóstico pronto); B volta para ajuste do respondente.
    orgA.transition("validated");
    orgB.transition("awaiting_adjustment");

    expect(orgA.state).toBe("validated");
    expect(orgB.state).toBe("awaiting_adjustment");

    // Coexistência de estados diferentes no MESMO formulário.
    expect(orgA.state).not.toBe(orgB.state);

    // B retoma validação após ajuste; A pode encerrar.
    orgB.transition("in_validation");
    orgA.transition("completed");
    expect(isCycleCompleted(orgA.state)).toBe(true);
    expect(isCycleCompleted(orgB.state)).toBe(false);
  });

  it("ciclo encerrado de A pode reabrir sem afetar B", () => {
    const orgA = new CycleModel("completed");
    const orgB = new CycleModel("validated");

    expect(canReopen(orgA.state)).toBe(true);
    expect(canReopen(orgB.state)).toBe(false); // só encerrados reabrem

    orgA.reopen();
    expect(orgA.state).toBe("in_response");
    expect(orgA.reopenCount).toBe(1);
    expect(orgB.state).toBe("validated"); // intocado
  });

  it("respondente não pode pular etapas (transições inválidas barradas)", () => {
    const cycle = new CycleModel("in_response");
    // Não pode ir direto de in_response para validated.
    expect(() => cycle.transition("validated")).toThrow();
    // completed não tem avanço no mapa; reabertura é via reopen_cycle.
    const done = new CycleModel("completed");
    expect(allowedTransitions(done.state)).toEqual([]);
    expect(canReopen(done.state)).toBe(true);
  });

  it("estados editáveis e pós-resposta são consistentes por ciclo", () => {
    expect(isRespondentEditable("in_response")).toBe(true);
    expect(isRespondentEditable("awaiting_adjustment")).toBe(true);
    expect(isRespondentEditable("in_validation")).toBe(false);
    expect(isRespondentEditable("validated")).toBe(false);
    expect(isRespondentEditable("completed")).toBe(false);
  });
});
