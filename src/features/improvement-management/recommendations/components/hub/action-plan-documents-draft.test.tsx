// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/shared/ui/components/confirm-dialog";
import { ActionPlanDocumentsDraft } from "./action-plan-documents-draft";

afterEach(() => {
  cleanup();
});

function renderDraft(
  items: Parameters<typeof ActionPlanDocumentsDraft>[0]["items"] = [],
  onChange = vi.fn(),
) {
  render(
    <ConfirmProvider>
      <ActionPlanDocumentsDraft items={items} onChange={onChange} />
    </ConfirmProvider>,
  );
  return { onChange };
}

function fileInput(): HTMLInputElement {
  // O botão de tipo também se chama "Arquivo"; o input é resolvido pelo seletor.
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Input de arquivo não encontrado.");
  }
  return input;
}

describe("ActionPlanDocumentsDraft", () => {
  it("inicia fechado, sem campos de anexo e sem mensagem de lista vazia", () => {
    renderDraft();

    expect(screen.getByRole("heading", { name: "Documentos e comprovantes" })).toBeTruthy();
    expect(
      screen.getByText("Opcional. Você pode adicionar arquivos ou links como comprovação da ação."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar comprovante" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(screen.queryByText(/Nenhum anexo selecionado ainda/i)).toBeNull();
    expect(screen.queryByLabelText("Título da comprovação")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("abre o composer e cancela sem alterar itens já existentes", () => {
    const existing = [
      {
        id: "d1",
        kind: "link" as const,
        title: "Portal",
        externalLink: "https://example.gov.br",
      },
    ];
    const { onChange } = renderDraft(existing);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar outro comprovante" }));
    expect(screen.getByLabelText("Título da comprovação")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Título da comprovação"), {
      target: { value: "Rascunho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Título da comprovação")).toBeNull();
    expect(screen.getByText("Portal")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adiciona arquivo válido e fecha o composer", () => {
    const { onChange } = renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));

    fireEvent.change(screen.getByLabelText("Título da comprovação"), {
      target: { value: "Relatório de implantação" },
    });
    const file = new File(["%PDF-1.4 content"], "relatorio.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      kind: "file",
      title: "Relatório de implantação",
    });
    expect(next[0].file).toBe(file);
    expect(screen.queryByLabelText("Título da comprovação")).toBeNull();
  });

  it("adiciona link HTTPS mesmo sem crypto.randomUUID no navegador", () => {
    const cryptoWithUuid = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {},
    });

    try {
      const { onChange } = renderDraft();
      fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));
      fireEvent.click(screen.getByRole("button", { name: "Link HTTPS" }));
      fireEvent.change(screen.getByLabelText("Título da comprovação"), {
        target: { value: "comprovante" },
      });
      fireEvent.change(screen.getByLabelText("URL"), {
        target: { value: "https://www.google.com/imghp?hl=pt-BR" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0]?.[0];
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({
        kind: "link",
        title: "comprovante",
      });
      expect(String(next[0].id)).toMatch(/^draft-/);
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: cryptoWithUuid,
      });
    }
  });

  it("adiciona link HTTPS e permite múltiplos comprovantes", () => {
    const existing = [
      {
        id: "d1",
        kind: "file" as const,
        title: "Ata",
        file: new File(["x"], "ata.pdf", { type: "application/pdf" }),
      },
    ];
    const { onChange } = renderDraft(existing);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar outro comprovante" }));
    fireEvent.click(screen.getByRole("button", { name: "Link HTTPS" }));
    fireEvent.change(screen.getByLabelText("Título da comprovação"), {
      target: { value: "Portal de transparência" },
    });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://transparencia.example.gov.br" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0];
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      kind: "link",
      title: "Portal de transparência",
      externalLink: "https://transparencia.example.gov.br/",
    });
  });

  it("rejeita arquivo acima de 20 MB e não altera a lista", () => {
    const { onChange } = renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));
    fireEvent.change(screen.getByLabelText("Título da comprovação"), {
      target: { value: "Arquivo grande" },
    });
    const huge = new File(["%PDF"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(huge, "size", { value: 21 * 1024 * 1024 });
    fireEvent.change(fileInput(), { target: { files: [huge] } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar comprovante" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/tamanho permitido/i);
  });

  it("pede confirmação antes de remover e cancela sem alterar a lista", () => {
    const items = [
      {
        id: "d1",
        kind: "link" as const,
        title: "Portal",
        externalLink: "https://example.gov.br",
      },
    ];
    const { onChange } = renderDraft(items);
    fireEvent.click(screen.getByRole("button", { name: "Remover comprovante Portal" }));

    expect(screen.getByRole("dialog", { name: "Remover este comprovante?" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Portal")).toBeTruthy();
  });

  it("remove o comprovante somente depois da confirmação", async () => {
    const items = [
      {
        id: "d1",
        kind: "link" as const,
        title: "Portal",
        externalLink: "https://example.gov.br",
      },
    ];
    const { onChange } = renderDraft(items);
    fireEvent.click(screen.getByRole("button", { name: "Remover comprovante Portal" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remover" }));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  it("lista arquivo com metadados e ação de remover", () => {
    const file = new File(["%PDF"], "Relatório de implantação.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: 2_400_000 });
    renderDraft([{ id: "d1", kind: "file", title: "Relatório", file }]);

    const list = screen.getByRole("list");
    expect(within(list).getByText("Relatório de implantação.pdf")).toBeTruthy();
    expect(within(list).getByText(/Arquivo ·/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar outro comprovante" })).toBeTruthy();
  });

  it("mostra o endereço do link no comprovante anexado", () => {
    renderDraft([
      {
        id: "d1",
        kind: "link",
        title: "comprovante",
        externalLink: "https://www.google.com/imghp?hl=pt-BR",
      },
    ]);

    const list = screen.getByRole("list");
    expect(within(list).getByText("comprovante")).toBeTruthy();
    expect(within(list).getByText("Link HTTPS · www.google.com")).toBeTruthy();
  });
});
