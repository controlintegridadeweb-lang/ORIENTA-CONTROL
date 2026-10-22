import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadHttpAttachment,
  filenameFromContentDisposition,
} from "./download-http-attachment";

describe("filenameFromContentDisposition", () => {
  it("lê o nome entre aspas", () => {
    expect(filenameFromContentDisposition('attachment; filename="respostas.xlsx"')).toBe(
      "respostas.xlsx",
    );
  });

  it("ignora cabeçalho ausente", () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
  });
});

describe("downloadHttpAttachment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propaga a mensagem de erro da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Diagnóstico não encontrado." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(downloadHttpAttachment("/api/cycles/x/answers/export", "respostas.xlsx")).rejects.toThrow(
      "Diagnóstico não encontrado.",
    );
  });
});
