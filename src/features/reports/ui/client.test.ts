// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPdfBlob, fetchCatalogReportPdf, fetchPersistedReportPdf } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchPersistedReportPdf", () => {
  it("pede a URL assinada em JSON e baixa o arquivo sem credentials", async () => {
    const signedUrl = "http://127.0.0.1:54321/storage/v1/object/sign/relatorios/a.pdf?token=x";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: signedUrl, filename: "relatorio-orienta-diagnostico-emissao-1.pdf" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([37, 80, 68, 70]), {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await fetchPersistedReportPdf("/api/reports/report-1/download");
    expect(await blob.arrayBuffer()).toEqual(new Uint8Array([37, 80, 68, 70]).buffer);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/reports/report-1/download",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, signedUrl);
    expect(fetchMock.mock.calls[1]?.[1]).toBeUndefined();
  });
});

describe("fetchCatalogReportPdf", () => {
  it("baixa o PDF bimestral direto da exportação, sem URL assinada", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await fetchCatalogReportPdf(
      "/api/monitoring/bimonthly/11111111-1111-4111-8111-111111111111/export?format=pdf",
    );
    expect(await blob.arrayBuffer()).toEqual(new Uint8Array([37, 80, 68, 70]).buffer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/monitoring/bimonthly/11111111-1111-4111-8111-111111111111/export?format=pdf",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("downloadPdfBlob", () => {
  it("nao revoga a blob URL no mesmo tick do click", () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    const create = vi.fn(() => "blob:report");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    vi.spyOn(document, "createElement").mockReturnValue({
      click,
      remove,
      rel: "",
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);

    downloadPdfBlob(new Blob(["pdf"]), "relatorio-orienta-emissao-1.pdf");
    expect(click).toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:report");
    appendChild.mockRestore();
  });
});
