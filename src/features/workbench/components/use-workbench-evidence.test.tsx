// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Row } from "./workbench-helpers";

const mocks = vi.hoisted(() => ({
  removeEvidenceAttachment: vi.fn(),
  uploadEvidenceFile: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@/infrastructure/client/workbench-api", () => ({
  removeEvidenceAttachment: mocks.removeEvidenceAttachment,
  uploadEvidenceFile: mocks.uploadEvidenceFile,
}));

vi.mock("@/shared/ui/components/confirm-dialog", () => ({
  useConfirm: () => mocks.confirm,
}));

import { useWorkbenchEvidence } from "./use-workbench-evidence";

const row: Row = {
  questionId: "question-1",
  prompt: "Pergunta",
  requiresEvidence: true,
  famiEnabled: true,
  recommendationText: "",
  axisName: "Governança",
  sectionName: "Seção",
  responseId: null,
  answer: null,
  notes: null,
  isNotApplicable: false,
  naJustification: null,
  naValidationStatus: null,
  naRejectionReason: null,
  evidenceId: null,
  evidenceTitle: null,
  evidenceDescription: null,
  externalLink: null,
  storagePath: null,
  validationStatus: null,
  validationJustification: null,
};

describe("useWorkbenchEvidence", () => {
  beforeEach(() => {
    mocks.removeEvidenceAttachment.mockReset();
    mocks.uploadEvidenceFile.mockReset();
    mocks.confirm.mockReset();
  });

  it("informa falha de conexão no upload e encerra o estado de envio", async () => {
    mocks.uploadEvidenceFile.mockRejectedValueOnce(new Error("conexão perdida"));
    const setFeedback = vi.fn();

    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench: vi.fn().mockResolvedValue(true),
        setFeedback,
        setSavingQuestionId: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleEvidenceFile(
        row,
        new File(["conteúdo"], "evidencia.pdf", {
          type: "application/pdf",
        }),
      );
    });

    expect(result.current.uploadingQuestionId).toBeNull();
    expect(setFeedback).toHaveBeenLastCalledWith({
      tone: "error",
      title: "Não foi possível atualizar a evidência",
      description: "conexão perdida",
    });
  });

  it("retorna false quando a remoção do upload temporário falha por rede", async () => {
    mocks.removeEvidenceAttachment.mockRejectedValueOnce(new Error("sem rede"));
    const setFeedback = vi.fn();

    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench: vi.fn().mockResolvedValue(true),
        setFeedback,
        setSavingQuestionId: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateEvidenceDraft(row.questionId, {
        kind: "file",
        pendingUploadId: "upload-1",
        storagePath: "org/cycle/file.pdf",
      });
    });

    let discarded = true;
    await act(async () => {
      discarded = await result.current.discardPendingUpload(row);
    });

    expect(discarded).toBe(false);
    expect(setFeedback).toHaveBeenLastCalledWith({
      tone: "error",
      title: "Não foi possível atualizar a evidência",
      description: "sem rede",
    });
  });

  it("mantém todos os arquivos selecionados no rascunho", async () => {
    mocks.uploadEvidenceFile
      .mockResolvedValueOnce(new Response(JSON.stringify({
        storagePath: "org/cycle/portaria.pdf",
        pendingUploadId: "11111111-1111-4111-8111-111111111111",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        storagePath: "org/cycle/ata.pdf",
        pendingUploadId: "22222222-2222-4222-8222-222222222222",
      }), { status: 200 }));

    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench: vi.fn().mockResolvedValue(true),
        setFeedback: vi.fn(),
        setSavingQuestionId: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleEvidenceFile(row, [
        new File(["a"], "portaria.pdf", { type: "application/pdf" }),
        new File(["b"], "ata.pdf", { type: "application/pdf" }),
      ]);
    });

    expect(result.current.evidenceDrafts[row.questionId]?.attachments).toHaveLength(2);
    expect(result.current.evidenceDrafts[row.questionId]?.attachments?.map((item) => item.title))
      .toEqual(["portaria", "ata"]);
  });

  it("remove somente o upload temporário selecionado do rascunho", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.removeEvidenceAttachment.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench: vi.fn().mockResolvedValue(true),
        setFeedback: vi.fn(),
        setSavingQuestionId: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateEvidenceDraft(row.questionId, {
        attachments: [
          {
            clientId: "upload-1",
            kind: "file",
            title: "Primeiro",
            description: "",
            externalLink: null,
            storagePath: "org/cycle/1.pdf",
            pendingUploadId: "upload-1",
          },
          {
            clientId: "upload-2",
            kind: "file",
            title: "Segundo",
            description: "",
            externalLink: null,
            storagePath: "org/cycle/2.pdf",
            pendingUploadId: "upload-2",
          },
        ],
      });
    });

    await act(async () => {
      await result.current.handleRemoveEvidence(row, {
        pendingUploadId: "upload-1",
        clientId: "upload-1",
      });
    });

    expect(result.current.evidenceDrafts[row.questionId]?.attachments).toEqual([
      expect.objectContaining({ pendingUploadId: "upload-2" }),
    ]);
  });

  it("preserva uploads novos ao remover uma evidência já salva", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.removeEvidenceAttachment.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const loadWorkbench = vi.fn().mockResolvedValue(true);
    const persistedRow = {
      ...row,
      evidenceId: "evidence-1",
      storagePath: "org/cycle/salva.pdf",
    };
    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench,
        setFeedback: vi.fn(),
        setSavingQuestionId: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateEvidenceDraft(row.questionId, {
        attachments: [
          {
            clientId: "upload-new",
            kind: "file",
            title: "Nova",
            description: "",
            externalLink: null,
            storagePath: "org/cycle/nova.pdf",
            pendingUploadId: "upload-new",
          },
        ],
      });
    });

    await act(async () => {
      await result.current.handleRemoveEvidence(persistedRow, {
        evidenceId: "evidence-1",
      });
    });

    expect(result.current.evidenceDrafts[row.questionId]?.attachments).toEqual([
      expect.objectContaining({ pendingUploadId: "upload-new" }),
    ]);
    expect(loadWorkbench).toHaveBeenCalledTimes(1);
  });

  it("bloqueia novos uploads quando o rascunho já contém vinte evidências", async () => {
    const setFeedback = vi.fn();
    const { result } = renderHook(() =>
      useWorkbenchEvidence({
        ids: { cycleId: "cycle-1" },
        loadWorkbench: vi.fn().mockResolvedValue(true),
        setFeedback,
        setSavingQuestionId: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateEvidenceDraft(row.questionId, {
        attachments: Array.from({ length: 20 }, (_, index) => ({
          clientId: `upload-${index}`,
          kind: "file" as const,
          title: `Arquivo ${index}`,
          description: "",
          externalLink: null,
          storagePath: `org/cycle/${index}.pdf`,
          pendingUploadId: `upload-${index}`,
        })),
      });
    });

    await act(async () => {
      await result.current.handleEvidenceFile(
        row,
        new File(["extra"], "extra.pdf", { type: "application/pdf" }),
      );
    });

    expect(mocks.uploadEvidenceFile).not.toHaveBeenCalled();
    expect(setFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Limite de evidências atingido" }),
    );
  });
});
