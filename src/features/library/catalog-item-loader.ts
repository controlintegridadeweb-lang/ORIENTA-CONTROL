import type { LibraryRepository } from "./repository";
import type { LibraryCatalogEntity, LibraryCatalogItem } from "./types";
import { LibraryValidationError } from "./errors";

export async function loadRequiredLibraryItem(
  repository: LibraryRepository,
  entity: LibraryCatalogEntity,
  id: string,
): Promise<LibraryCatalogItem> {
  const item = await repository.findCatalogItem(entity, id);
  if (!item) {
    throw new LibraryValidationError([
      { path: "id", message: "Item não encontrado." },
    ]);
  }
  return item;
}
