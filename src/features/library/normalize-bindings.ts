import type { InlineLibraryRecommendation, LibraryBindings } from "./binding-types";

function normalizeRecommendation(raw: unknown): InlineLibraryRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) return null;
  return value as InlineLibraryRecommendation;
}


/** Normaliza somente o contrato canônico armazenado em `bindings`. */
export function normalizeBindings(raw: unknown): LibraryBindings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  return {
    defaultRecommendation: normalizeRecommendation(record.defaultRecommendation),
    note: typeof record.note === "string" ? record.note : null,
  };
}

export function bindingHasRecommendation(bindings: LibraryBindings): boolean {
  return Boolean(bindings.defaultRecommendation?.title?.trim());
}
