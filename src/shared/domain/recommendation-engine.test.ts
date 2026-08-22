import { describe, expect, it } from "vitest";
import {
  inferRecommendationDetail,
} from "./recommendation-engine";

describe("inferRecommendationDetail — 3 tipos canônicos", () => {
  it("gera não implementação para resposta Não", () => {
    expect(
      inferRecommendationDetail({ answer: "no", requiresEvidence: false, famiEnabled: true }),
    ).toEqual({ tipo: "nao_implementacao", trigger: "resposta_nao" });
  });

  it("gera ausência de evidência quando o anexo obrigatório não existe", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: false,
        famiEnabled: true,
      }),
    ).toEqual({ tipo: "ausencia_evidencia", trigger: "evidencia_ausente" });
  });

  it("gera evidência insuficiente para evidência invalidada", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: true,
        validationStatus: "invalidated",
        famiEnabled: true,
      }),
    ).toEqual({ tipo: "evidencia_insuficiente", trigger: "evidencia_invalida" });
  });

  it("gera evidência insuficiente para decisão administrativa sem documento", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: false,
        adminProofStatus: "considered_insufficient",
        famiEnabled: true,
      }),
    ).toEqual({ tipo: "evidencia_insuficiente", trigger: "evidencia_invalida" });
  });

  it("mantém recomendação para resposta Não fora do cálculo FAMI", () => {
    expect(
      inferRecommendationDetail({
        answer: "no",
        requiresEvidence: false,
        famiEnabled: false,
      }),
    ).toEqual({ tipo: "nao_implementacao", trigger: "resposta_nao" });
  });

  it("não gera recomendação para Sim aprovado com evidência", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: true,
        validationStatus: "approved",
        famiEnabled: true,
      }),
    ).toBeNull();
  });

  it("não gera recomendação durante uma solicitação de ajuste", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: true,
        validationStatus: "adjustment_requested",
        famiEnabled: true,
      }),
    ).toBeNull();
  });

  it("não gera enquanto a evidência ainda está pendente", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: true,
        validationStatus: "pending",
        famiEnabled: true,
      }),
    ).toBeNull();
  });
});

