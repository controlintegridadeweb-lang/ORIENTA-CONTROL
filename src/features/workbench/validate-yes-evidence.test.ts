import { describe, expect, it } from "vitest";
import {
  EVIDENCE_ATTACHMENT_MESSAGE,
  EVIDENCE_TITLE_MESSAGE,
  validateYesWithEvidence,
} from "./validate-yes-evidence";

describe("validateYesWithEvidence", () => {
  it("fails when attachment and title are missing", () => {
    const r = validateYesWithEvidence({ kind: null, title: "", storagePath: null, externalLink: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.attachment).toBe(EVIDENCE_ATTACHMENT_MESSAGE);
    expect(r.errors.title).toBe(EVIDENCE_TITLE_MESSAGE);
  });

  it("fails when only file is present without title", () => {
    const r = validateYesWithEvidence({
      kind: "file",
      title: "  ",
      storagePath: "org/form/file.pdf",
      externalLink: "",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.title).toBe(EVIDENCE_TITLE_MESSAGE);
    expect(r.errors.attachment).toBeUndefined();
  });

  it("fails when only title is present", () => {
    const r = validateYesWithEvidence({
      kind: "link",
      title: "Politica",
      storagePath: null,
      externalLink: "",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.attachment).toBe(EVIDENCE_ATTACHMENT_MESSAGE);
  });

  it("passes with file and title", () => {
    const r = validateYesWithEvidence({
      kind: "file",
      title: "Politica",
      storagePath: "org/form/a.pdf",
      externalLink: "",
    });
    expect(r.ok).toBe(true);
  });

  it("passes with link and title", () => {
    const r = validateYesWithEvidence({
      kind: "link",
      title: "Politica",
      storagePath: null,
      externalLink: "https://example.com/doc",
    });
    expect(r.ok).toBe(true);
  });

  it("does not treat server file as attachment when switching to link mode", () => {
    const r = validateYesWithEvidence(
      { kind: "link", title: "Doc", storagePath: null, externalLink: "" },
      { storagePath: "org/old.pdf", externalLink: null, title: "Old" },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.attachment).toBe(EVIDENCE_ATTACHMENT_MESSAGE);
  });

  it("accepts complete evidence stored on server without draft", () => {
    const r = validateYesWithEvidence(
      { kind: null, title: "", storagePath: null, externalLink: "" },
      {
        title: "Salvo",
        storagePath: "org/form/x.pdf",
        externalLink: null,
      },
    );
    expect(r.ok).toBe(true);
  });
});
