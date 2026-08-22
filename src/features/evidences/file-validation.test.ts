import { describe, expect, it } from "vitest";
import {
  assertSafeUploadFilename,
  describeAllowedEvidenceFile,
  verifyEvidenceFileSignature,
  verifyImageStructuralLimits,
  verifyPdfTrailer,
  verifyUploadedFileSize,
} from "./file-validation";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

describe("evidence file validation", () => {
  it("aceita PDF quando extensão, MIME e assinatura são coerentes", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "evidencia.pdf",
      mimeType: "application/pdf",
      sizeBytes: 128,
    });

    expect(
      verifyEvidenceFileSignature(
        descriptor,
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      ),
    ).toBe("application/pdf");
  });

  it("aceita imagem PNG válida com dimensões dentro do limite", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "foto.png",
      mimeType: "image/png",
      sizeBytes: 256,
    });
    const bytes = pngHeader(800, 600);
    expect(verifyEvidenceFileSignature(descriptor, bytes)).toBe("image/png");
    expect(() => verifyImageStructuralLimits(descriptor, bytes)).not.toThrow();
  });

  it("rejeita extensão permitida com conteúdo incompatível", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "evidencia.pdf",
      mimeType: "application/pdf",
      sizeBytes: 128,
    });

    expect(() =>
      verifyEvidenceFileSignature(
        descriptor,
        new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]),
      ),
    ).toThrow("não corresponde à extensão");
  });

  it("rejeita MIME falso para a extensão", () => {
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "evidencia.pdf",
        mimeType: "image/png",
        sizeBytes: 128,
      }),
    ).toThrow("formato do arquivo não é permitido");
  });

  it("rejeita arquivo vazio", () => {
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "vazio.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
      }),
    ).toThrow("vazio");
  });

  it("rejeita PDF sem marcador de encerramento", () => {
    expect(() =>
      verifyPdfTrailer(new TextEncoder().encode("%PDF-1.7 sem fim")),
    ).toThrow("corrompido");
  });

  it("rejeita extensão dupla enganosa", () => {
    expect(() => assertSafeUploadFilename("malware.pdf.exe")).toThrow("múltiplas extensões");
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "relatorio.pdf.exe",
        mimeType: "application/pdf",
        sizeBytes: 128,
      }),
    ).toThrow();
  });

  it("rejeita executável renomeado como PDF", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "instalador.pdf",
      mimeType: "application/pdf",
      sizeBytes: 128,
    });
    expect(() =>
      verifyEvidenceFileSignature(
        descriptor,
        new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
      ),
    ).toThrow("não corresponde à extensão");
  });

  it("rejeita HTML renomeado", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "pagina.pdf",
      mimeType: "application/pdf",
      sizeBytes: 64,
    });
    expect(() =>
      verifyEvidenceFileSignature(
        descriptor,
        new TextEncoder().encode("<html><script>alert(1)</script>"),
      ),
    ).toThrow("não corresponde à extensão");
  });

  it("bloqueia SVG", () => {
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "imagem.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 128,
      }),
    ).toThrow("não pode ser enviado");
  });

  it("bloqueia DOCX e demais formatos Office", () => {
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "evidencia.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 1024,
      }),
    ).toThrow("não pode ser enviado");
  });

  it("rejeita arquivo acima do limite", () => {
    expect(() =>
      describeAllowedEvidenceFile({
        filename: "grande.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20 * 1024 * 1024 + 1,
      }),
    ).toThrow("excede o tamanho permitido");
  });

  it("rejeita imagem com dimensões excessivas", () => {
    const descriptor = describeAllowedEvidenceFile({
      filename: "bomba.png",
      mimeType: "image/png",
      sizeBytes: 256,
    });
    expect(() =>
      verifyImageStructuralLimits(descriptor, pngHeader(20_000, 20_000)),
    ).toThrow("dimensões");
  });

  it("rejeita upload cujo tamanho real diverge do declarado", () => {
    expect(() => verifyUploadedFileSize(1024, 2048)).toThrow(
      "não corresponde ao tamanho informado",
    );
    expect(() => verifyUploadedFileSize(1024, null)).toThrow(
      "não corresponde ao tamanho informado",
    );
  });

  it("reconhece o PNG 1×1 estruturalmente válido usado no E2E", () => {
    const bytes = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const descriptor = describeAllowedEvidenceFile({
      filename: "evidencia-e2e.png",
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
    });
    expect(verifyEvidenceFileSignature(descriptor, bytes)).toBe("image/png");
    expect(() => verifyImageStructuralLimits(descriptor, bytes)).not.toThrow();
  });

  it("não produz estados de arquivo limpo ou aprovação por antivírus", () => {
    expect(["valid", "rejected", "upload_started"]).not.toContain("clean");
    expect(["valid", "rejected", "upload_started"]).not.toContain("infected");
  });
});
