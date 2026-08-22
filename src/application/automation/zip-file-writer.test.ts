import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StoredZipFileWriter } from "./zip-file-writer";

const temporaryDirectories: string[] = [];

async function createTemporaryZipPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "orienta-zip-"));
  temporaryDirectories.push(directory);
  return join(directory, "pacote.zip");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("StoredZipFileWriter", () => {
  it("grava entradas UTF-8 e finaliza o diretório central", async () => {
    const filePath = await createTemporaryZipPath();
    const writer = await StoredZipFileWriter.create(filePath);

    try {
      await writer.add(
        "relatorios/órgão.pdf",
        new TextEncoder().encode("PDF"),
        new Date(2026, 0, 1, 12, 0, 0),
      );
      await writer.finalize();
    } finally {
      await writer.close();
    }

    const zip = await readFile(filePath);
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(zip.toString("utf8")).toContain("relatorios/órgão.pdf");
    expect(Array.from(zip.subarray(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("bloqueia caminhos que poderiam escapar do pacote", async () => {
    const filePath = await createTemporaryZipPath();
    const writer = await StoredZipFileWriter.create(filePath);

    try {
      await expect(writer.add("../segredo.txt", new Uint8Array())).rejects.toThrow(
        "Nome de arquivo inválido",
      );
    } finally {
      await writer.close();
    }
  });
});
