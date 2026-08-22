// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CriterionScore } from "./criterion-score";

afterEach(() => {
  cleanup();
});

describe("CriterionScore", () => {
  it("não renderiza quando o critério está fora do FAMI", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence={false}
        famiEnabled={false}
      />,
    );
    expect(screen.queryByText(/Pontuação/)).toBeNull();
  });

  it("mostra 0 de 2 enquanto a evidência aguarda aprovação", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence
        evidenceStatus="pending"
      />,
    );
    const badge = screen.getByText("Pontuação · 0 de 2");
    expect(badge.getAttribute("data-criterion-reason")).toBe(
      "evidence_not_approved",
    );
    expect(badge.getAttribute("title")).toContain(
      "Evidência aguardando validação.",
    );
    expect(badge.getAttribute("title")).toContain("Pontuação · 0 de 2");
  });

  it("mostra 2 de 2 com evidência aprovada", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence
        evidenceStatus="approved"
        diagnosisStatus="validated"
        famiProcessingStatus="completed"
      />,
    );
    const badge = screen.getByText("Pontuação · 2 de 2");
    expect(badge.getAttribute("title")).toContain("Evidência aprovada.");
    expect(badge.getAttribute("title")).toContain("Pontuação · 2 de 2");
  });

  it("mostra 0 de 2 sem comprovação", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence
        evidenceStatus="not_submitted"
      />,
    );
    const badge = screen.getByText("Pontuação · 0 de 2");
    expect(badge.getAttribute("title")).toContain(
      "Resposta positiva sem comprovação.",
    );
  });

  it("mostra 0 de 2 quando validado sem comprovação", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence
        evidenceStatus="validated_without_proof"
      />,
    );
    const badge = screen.getByText("Pontuação · 0 de 2");
    expect(badge.getAttribute("title")).toContain(
      "Validado sem comprovação.",
    );
  });

  it("mostra 0 de 2 com evidência insuficiente", () => {
    render(
      <CriterionScore
        answer="yes"
        requiresEvidence
        evidenceStatus="insufficient"
      />,
    );
    expect(screen.getByText("Pontuação · 0 de 2")).toBeTruthy();
  });

  it("mostra 1 de 1 em Sim sem exigência de evidência", () => {
    render(
      <CriterionScore answer="yes" requiresEvidence={false} />,
    );
    expect(screen.getByText("Pontuação · 1 de 1")).toBeTruthy();
  });

  it("mostra 0 de 1 em Não sem exigência de evidência", () => {
    render(
      <CriterionScore answer="no" requiresEvidence={false} />,
    );
    expect(screen.getByText("Pontuação · 0 de 1")).toBeTruthy();
  });
});
