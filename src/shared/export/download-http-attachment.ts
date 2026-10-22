import { z } from "zod";

const errorBodySchema = z.object({ error: z.string().optional() }).passthrough();

export function filenameFromContentDisposition(header: string | null): string | null {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  const filename = match?.[1]?.trim();
  return filename || null;
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = "Não foi possível baixar o arquivo.";
  const text = (await response.text()).trim();
  if (!text) return fallback;
  try {
    const parsed = errorBodySchema.safeParse(JSON.parse(text));
    return parsed.success && parsed.data.error ? parsed.data.error : fallback;
  } catch {
    return fallback;
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Baixa um anexo HTTP na sessão atual e usa a mensagem `error` quando a API recusa. */
export async function downloadHttpAttachment(
  url: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(url, { headers: { Accept: "*/*" } });
  if (!response.ok) throw new Error(await errorMessage(response));
  const filename =
    filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
    fallbackFilename;
  saveBlob(await response.blob(), filename);
}
