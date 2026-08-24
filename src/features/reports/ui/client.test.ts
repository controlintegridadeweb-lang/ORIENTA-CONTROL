// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPdfBlob, fetchPersistedReportPdf } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchPersistedReportPdf", () => {
  it("segue a URL assinada sem credentials nem Content-Type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { Location: "http://127.0.0.1:54321/storage/v1/object/sign/relatorios/a.pdf?token=x" },
        }),
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
      expect.objectContaining({ credentials: "include", redirect: "manual" }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:54321/storage/v1/object/sign/relatorios/a.pdf?token=x",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toBeUndefined();
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
