import { describe, expect, it } from "vitest";
import {
  canTransition,
  canReopen,
  canReopenValidation,
  isActionPlanEligible,
  isCycleCompleted,
  isCyclePastResponsePhase,
  isOfficialFamiEligible,
  isRespondentEditable,
  isRespondentSubmissionTransition,
  TRANSITION_EFFECT,
} from "./workflow";
import {
  CANONICAL_TRANSITIONS,
  REOPEN_TRANSITION,
  VALIDATION_REOPEN_TRANSITION,
} from "./types";

describe("workflow — 7 arestas de avanço", () => {
  for (const [from, to] of CANONICAL_TRANSITIONS) {
    it(`aceita ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }

  it("rejeita rollbacks para draft", () => {
    expect(canTransition("in_response", "draft")).toBe(false);
    expect(canTransition("submitted", "draft")).toBe(false);
  });

  it("reabertura não está no mapa canTransition", () => {
    const [from, to] = REOPEN_TRANSITION;
    expect(canTransition(from, to)).toBe(false);
    expect(canReopen(from)).toBe(true);
    expect(TRANSITION_EFFECT[`${from}->${to}`] ?? null).toBe("reopen");
  });

  it("mantém exatamente 7 arestas canônicas", () => {
    expect(CANONICAL_TRANSITIONS).toHaveLength(7);
  });
});

describe("propriedade das transições de envio", () => {
  it("reserva envio inicial e reenvio ao respondente", () => {
    expect(isRespondentSubmissionTransition("in_response", "submitted")).toBe(true);
    expect(isRespondentSubmissionTransition("awaiting_adjustment", "in_validation")).toBe(true);
  });

  it("não classifica transições administrativas como envio do respondente", () => {
    expect(isRespondentSubmissionTransition("submitted", "in_validation")).toBe(false);
    expect(isRespondentSubmissionTransition("draft", "in_response")).toBe(false);
  });
});

describe("isCycleCompleted", () => {
  it("aceita apenas o estado completed", () => {
    expect(isCycleCompleted("completed")).toBe(true);
    expect(isCycleCompleted("closed")).toBe(false);
  });
});

describe("isRespondentEditable", () => {
  it("abre em in_response e awaiting_adjustment", () => {
    expect(isRespondentEditable("in_response")).toBe(true);
    expect(isRespondentEditable("awaiting_adjustment")).toBe(true);
  });

  it("fecha draft e validated", () => {
    expect(isRespondentEditable("draft")).toBe(false);
    expect(isRespondentEditable("validated")).toBe(false);
  });
});

describe("isActionPlanEligible", () => {
  it("permite somente validated", () => {
    expect(isActionPlanEligible("validated")).toBe(true);
    expect(isActionPlanEligible("completed")).toBe(false);
  });
});

describe("isOfficialFamiEligible", () => {
  it("é elegível desde validated e permanece em completed", () => {
    expect(isOfficialFamiEligible("validated")).toBe(true);
    expect(isOfficialFamiEligible("completed")).toBe(true);
    expect(isOfficialFamiEligible("in_validation")).toBe(false);
  });
});

describe("isCyclePastResponsePhase", () => {
  it("inclui submitted e completed", () => {
    expect(isCyclePastResponsePhase("submitted")).toBe(true);
    expect(isCyclePastResponsePhase("completed")).toBe(true);
  });
});

const SQL_FORWARD_EDGES = [
  "draft->in_response",
  "in_response->submitted",
  "submitted->in_validation",
  "in_validation->awaiting_adjustment",
  "awaiting_adjustment->in_validation",
  "in_validation->validated",
  "validated->completed",
];

describe("paridade SQL ↔ TS (cycle_can_transition — avanço)", () => {
  it("conjuntos de arestas de avanço idênticos", () => {
    const tsEdges = CANONICAL_TRANSITIONS
      .map(([a, b]) => `${a}->${b}`)
      .sort();
    expect(tsEdges).toEqual([...SQL_FORWARD_EDGES].sort());
  });
});

describe("reabertura — 8ª aresta (completed → in_response)", () => {
  it("NÃO está entre as arestas de avanço (é destrutiva/excepcional)", () => {
    // canTransition cobre só avanço; a reabertura fica fora de propósito,
    // tratada por reopen_cycle. Isto trava regressão para os dois lados:
    // não pode virar avanço comum, nem sumir do despacho de efeito.
    expect(canTransition("completed", "in_response")).toBe(false);
  });

  it("é reconhecida como efeito 'reopen' pelo endpoint único", () => {
    // É exatamente o ponto onde o bloqueio ocorreria: se o mapa de efeitos não
    // devolvesse 'reopen', a rota cairia no 409 antes da RPC.
    expect(TRANSITION_EFFECT["completed->in_response"] ?? null).toBe("reopen");
  });

  it("alvo da reabertura é in_response (recoleta), nunca draft", () => {
    // Voltar a draft invalidaria o snapshot contra o qual o ciclo foi pontuado.
    const [from, to] = REOPEN_TRANSITION;
    expect(from).toBe("completed");
    expect(to).toBe("in_response");
  });

  it("só ciclos encerrados podem reabrir (canReopen)", () => {
    expect(canReopen("completed")).toBe(true);
    expect(canReopen("closed")).toBe(false);
    expect(canReopen("validated")).toBe(false);
    expect(canReopen("in_response")).toBe(false);
    expect(canReopen(null)).toBe(false);
  });

  it("ciclo reaberto volta a ser editável pelo respondente", () => {
    // A reabertura devolve a edição "dentro das regras permitidas":
    // in_response é estado editável; completed não era.
    expect(isRespondentEditable("in_response")).toBe(true);
    expect(isRespondentEditable("completed")).toBe(false);
  });
});

describe("reabertura de validação — validated → in_validation", () => {
  it("não está no mapa canTransition", () => {
    const [from, to] = VALIDATION_REOPEN_TRANSITION;
    expect(canTransition(from, to)).toBe(false);
    expect(from).toBe("validated");
    expect(to).toBe("in_validation");
  });

  it("é reconhecida como efeito reopen_validation", () => {
    expect(TRANSITION_EFFECT["validated->in_validation"] ?? null).toBe(
      "reopen_validation",
    );
  });

  it("só validated pode reabrir a validação", () => {
    expect(canReopenValidation("validated")).toBe(true);
    expect(canReopenValidation("completed")).toBe(false);
    expect(canReopenValidation("in_validation")).toBe(false);
    expect(canReopenValidation(null)).toBe(false);
  });

  it("não reabre o preenchimento do respondente", () => {
    expect(isRespondentEditable("in_validation")).toBe(false);
    expect(isOfficialFamiEligible("in_validation")).toBe(false);
  });
});
