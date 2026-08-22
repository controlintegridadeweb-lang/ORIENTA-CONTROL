import "server-only";

import { open, type FileHandle } from "node:fs/promises";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

type CentralEntry = {
  name: Uint8Array;
  checksum: number;
  size: number;
  time: number;
  day: number;
  offset: number;
};

function normalizeEntryName(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === ".." || segment.includes("\0"))) {
    throw new Error("Nome de arquivo inválido para o pacote ZIP.");
  }
  return segments.join("/");
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: (date.getDate() & 31) | ((date.getMonth() + 1) << 5) | ((year - 1980) << 9),
  };
}

function u16(value: number) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number) {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function concat(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export class StoredZipFileWriter {
  private constructor(
    private readonly handle: FileHandle,
    private readonly entries: CentralEntry[] = [],
    private offset = 0,
  ) {}

  static async create(filePath: string): Promise<StoredZipFileWriter> {
    return new StoredZipFileWriter(await open(filePath, "w"));
  }

  private async write(data: Uint8Array): Promise<void> {
    await this.handle.write(data, 0, data.length, this.offset);
    this.offset += data.length;
  }

  async add(nameValue: string, data: Uint8Array, modifiedAt = new Date()): Promise<void> {
    if (this.entries.length >= 65_535) throw new Error("O pacote ZIP excede o limite de arquivos.");
    if (data.length > 0xffffffff) throw new Error("Um arquivo excede o limite do formato ZIP utilizado.");

    const name = new TextEncoder().encode(normalizeEntryName(nameValue));
    const checksum = crc32(data);
    const { time, day } = dosDateTime(modifiedAt);
    const offset = this.offset;
    const header = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(time),
      u16(day),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    await this.write(header);
    await this.write(data);
    this.entries.push({ name, checksum, size: data.length, time, day, offset });
  }

  async finalize(): Promise<void> {
    const centralOffset = this.offset;
    for (const entry of this.entries) {
      await this.write(concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(entry.time),
        u16(entry.day),
        u32(entry.checksum),
        u32(entry.size),
        u32(entry.size),
        u16(entry.name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(entry.offset),
        entry.name,
      ]));
    }
    const centralSize = this.offset - centralOffset;
    await this.write(concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(this.entries.length),
      u16(this.entries.length),
      u32(centralSize),
      u32(centralOffset),
      u16(0),
    ]));
    await this.handle.sync();
  }

  async close(): Promise<void> {
    await this.handle.close();
  }
}
