import { describe, expect, it } from "vitest";
import {
  hasAnyEvidenceContent,
  hasEvidenceContent,
  hasFileEvidence,
  hasLinkEvidence,
  hasTextEvidence,
} from "./evidence-presence";

describe("evidence-presence", () => {
  it("nunca trata notes/comentário como comprovação", () => {
    // notes não faz parte de EvidencePresenceFields — só kind/path/link/textBody.
    expect(
      hasEvidenceContent({
        kind: null,
        storagePath: null,
        externalLink: null,
        textBody: null,
        title: "Observação do respondente",
      }),
    ).toBe(false);
    expect(
      hasAnyEvidenceContent([
        { kind: null, storagePath: null, externalLink: null, textBody: "   " },
      ]),
    ).toBe(false);
  });

  it("reconhece comprovação textual pendente (conteúdo presente)", () => {
    expect(
      hasTextEvidence({
        kind: "text",
        textBody: "Descrição da prática institucional.",
      }),
    ).toBe(true);
    expect(
      hasEvidenceContent({
        kind: "text",
        textBody: "Descrição da prática institucional.",
        storagePath: null,
        externalLink: null,
      }),
    ).toBe(true);
  });

  it("reconhece comprovação textual aprovada da mesma forma (presença ≠ veredito)", () => {
    // Presença não depende de validationStatus — aprovação é outro eixo.
    expect(
      hasEvidenceContent({
        kind: "text",
        textBody: "Texto já validado administrativamente.",
      }),
    ).toBe(true);
  });

  it("não mistura modalidades quando kind está definido", () => {
    expect(
      hasFileEvidence({
        kind: "text",
        storagePath: "org/cycle/arquivo.pdf",
        textBody: "texto",
      }),
    ).toBe(false);
    expect(
      hasLinkEvidence({
        kind: "text",
        externalLink: "https://exemplo.gov.br",
        textBody: "texto",
      }),
    ).toBe(false);
    expect(
      hasTextEvidence({
        kind: "file",
        storagePath: "org/cycle/arquivo.pdf",
        textBody: "texto",
      }),
    ).toBe(false);
  });
});
