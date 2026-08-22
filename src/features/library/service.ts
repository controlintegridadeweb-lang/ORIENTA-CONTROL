import { LibraryRepository, type LibraryActorContext } from "./repository";
import { libraryCatalogInputSchemaByEntity, type LibraryCatalogInputByEntity } from "./schemas";
import { logInfo } from "@/infrastructure/observability/logger";
import { ESG_AXIS_MUTATION_FORBIDDEN } from "@/features/library/domain/fixed-axes";
import { getLibraryAudit, type LibraryAuditEvent } from "./audit";
import { LibraryLifecycleService, type TransitionOptions } from "./lifecycle-service";
import { loadRequiredLibraryItem } from "./catalog-item-loader";
import { LibraryConflictError, LibraryValidationError, flattenLibraryValidationIssues, throwLibrarySupabaseError } from "./errors";
import { LIBRARY_ITEM_TYPE_BY_ENTITY, type LibraryCatalogEntity, type LibraryCatalogItem, type LibraryCatalogSnapshot, type LibraryItemType } from "./types";

export { LibraryValidationError } from "./errors";

export type LibraryServiceContext = LibraryActorContext;

type VersionedLibraryTable =
  | "sections"
  | "library_recommendations";

const VERSIONED_TABLE_BY_ENTITY: Record<
  Exclude<LibraryCatalogEntity, "axes">,
  VersionedLibraryTable
> = {
  sections: "sections",
  recommendations: "library_recommendations",
};

const CODE_PREFIX_BY_ENTITY: Record<LibraryCatalogEntity, string> = {
  axes: "EIX",
  sections: "SEC",
  recommendations: "REC",
};

function versionedTableFor(entity: LibraryCatalogEntity): VersionedLibraryTable {
  if (entity === "axes") {
    throw new LibraryValidationError([{ path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN }]);
  }
  return VERSIONED_TABLE_BY_ENTITY[entity];
}

function parseCatalog<E extends LibraryCatalogEntity>(
  entity: E,
  payload: unknown,
): LibraryCatalogInputByEntity[E] {
  const parsed = libraryCatalogInputSchemaByEntity[entity].safeParse(payload);
  if (!parsed.success) {
    throw new LibraryValidationError(flattenLibraryValidationIssues(parsed.error));
  }
  return parsed.data as LibraryCatalogInputByEntity[E];
}

function slugifyForCode(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return normalized.slice(0, 8);
}

function padNumber(value: number, width = 3): string {
  return value.toString().padStart(width, "0");
}

export class LibraryService {
  private readonly repo: LibraryRepository;
  private readonly lifecycle: LibraryLifecycleService;

  constructor(repo?: LibraryRepository) {
    this.repo = repo ?? new LibraryRepository();
    this.lifecycle = new LibraryLifecycleService(this.repo);
  }

  /** Biblioteca Geral (admin): eixos, secoes e planos de acao (modelo). */
  snapshotCatalog(): Promise<LibraryCatalogSnapshot> {
    return this.repo.snapshotCatalog();
  }


  private async resolveAutoCode<E extends LibraryCatalogEntity>(
    entity: E,
    input: LibraryCatalogInputByEntity[E],
  ): Promise<string> {
    const table = versionedTableFor(entity);
    let base: string;

    if (entity === "axes") {
      const axisInput = input as LibraryCatalogInputByEntity["axes"];
      base = slugifyForCode(axisInput.name) || CODE_PREFIX_BY_ENTITY.axes;
    } else if (entity === "sections") {
      const sectionInput = input as LibraryCatalogInputByEntity["sections"];
      const axis = await this.repo.findAxis(sectionInput.axisId);
      const axisPrefix = axis?.code ? axis.code.toUpperCase() : CODE_PREFIX_BY_ENTITY.sections;
      base = axisPrefix;
    } else if (entity === "recommendations") {
      const recInput = input as LibraryCatalogInputByEntity["recommendations"];
      base = slugifyForCode(recInput.title) || CODE_PREFIX_BY_ENTITY.recommendations;
    } else {
      const recInput = input as LibraryCatalogInputByEntity["recommendations"];
      base = slugifyForCode(recInput.title) || CODE_PREFIX_BY_ENTITY.recommendations;
    }

    const directCandidate = base;
    if (entity !== "sections" && !(await this.repo.isCodeTaken(table, directCandidate))) {
      return directCandidate;
    }

    for (let i = 1; i < 1000; i += 1) {
      const candidate = `${base}-${padNumber(i)}`;
      const taken = await this.repo.isCodeTaken(table, candidate);
      if (!taken) return candidate;
    }

    return `${base}-${Date.now()}`;
  }

  private async resolveAutoOrdem<E extends LibraryCatalogEntity>(
    entity: E,
    input: LibraryCatalogInputByEntity[E],
  ): Promise<number | undefined> {
    if (entity === "axes") {
      return this.repo.nextOrdemForAxes();
    }
    if (entity === "sections") {
      const sectionInput = input as LibraryCatalogInputByEntity["sections"];
      return this.repo.nextOrdemForSectionsByAxis(sectionInput.axisId);
    }
    return undefined;
  }

  private async applyAutoDefaults<E extends LibraryCatalogEntity>(
    entity: E,
    input: LibraryCatalogInputByEntity[E],
  ): Promise<LibraryCatalogInputByEntity[E]> {
    const filled: Record<string, unknown> = Object.fromEntries(Object.entries(input));

    if (!filled.code || typeof filled.code !== "string" || filled.code.trim().length === 0) {
      filled.code = await this.resolveAutoCode(entity, input);
    }

    if ((entity === "axes" || entity === "sections") && (filled.ordem === undefined || filled.ordem === null)) {
      filled.ordem = await this.resolveAutoOrdem(entity, input);
    }

    return parseCatalog(entity, filled);
  }

  async create<E extends LibraryCatalogEntity>(
    entity: E,
    payload: unknown,
    context: LibraryServiceContext = {},
  ): Promise<LibraryCatalogItem> {
    if (entity === "axes") {
      throw new LibraryValidationError([{ path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN }]);
    }
    const parsedInput = parseCatalog(entity, payload);
    const input = await this.applyAutoDefaults(entity, parsedInput);
    try {
      let item: LibraryCatalogItem;
      switch (entity) {
        case "sections":
          item = await this.repo.createSection(
            input as LibraryCatalogInputByEntity["sections"],
            context,
          );
          break;
        case "recommendations":
          item = await this.repo.createRecommendation(
            input as LibraryCatalogInputByEntity["recommendations"],
            context,
          );
          break;
        default:
          throw new Error(`Entidade não suportada: ${entity}`);
      }
      logInfo("library.item.created", {
        entity,
        itemId: item.id,
        actorUserId: context.userId ?? null,
      });
      void getLibraryAudit().record({
        action: "created",
        entity,
        itemType: LIBRARY_ITEM_TYPE_BY_ENTITY[entity],
        itemId: item.id,
        actorUserId: context.userId ?? null,
        toStatus: item.status,
        toVersion: item.version,
      } satisfies LibraryAuditEvent);
      return item;
    } catch (error) {
      if (error instanceof LibraryValidationError || error instanceof LibraryConflictError) {
        throw error;
      }
      throwLibrarySupabaseError(error);
    }
  }

  async update<E extends LibraryCatalogEntity>(
    entity: E,
    id: string,
    payload: unknown,
    context: LibraryServiceContext = {},
  ): Promise<LibraryCatalogItem> {
    if (entity === "axes") {
      throw new LibraryValidationError([{ path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN }]);
    }
    const parsedInput = parseCatalog(entity, payload);
    const current = await loadRequiredLibraryItem(this.repo, entity, id);
    const preserved: Record<string, unknown> = Object.fromEntries(Object.entries(parsedInput));

    if (!preserved.code || typeof preserved.code !== "string" || preserved.code.trim().length === 0) {
      preserved.code = current.code;
    } else if (preserved.code !== current.code) {
      preserved.code = current.code;
    }

    if ((entity === "axes" || entity === "sections") && (preserved.ordem === undefined || preserved.ordem === null)) {
      preserved.ordem = (current as { ordem: number }).ordem ?? 0;
    }

    const input = parseCatalog(entity, preserved);
    try {
      let item: LibraryCatalogItem;
      switch (entity) {
        case "axes":
          throw new LibraryValidationError([
            { path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN },
          ]);
        case "sections":
          item = await this.repo.updateSection(
            id,
            input as LibraryCatalogInputByEntity["sections"],
            context,
          );
          break;
        case "recommendations":
          item = await this.repo.updateRecommendation(
            id,
            input as LibraryCatalogInputByEntity["recommendations"],
            context,
          );
          break;
        default:
          throw new Error(`Entidade não suportada: ${entity}`);
      }
      logInfo("library.item.updated", {
        entity,
        itemId: item.id,
        actorUserId: context.userId ?? null,
      });
      return item;
    } catch (error) {
      if (error instanceof LibraryValidationError || error instanceof LibraryConflictError) {
        throw error;
      }
      throwLibrarySupabaseError(error);
    }
  }

  async remove(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext = {},
  ): Promise<void> {
    try {
      switch (entity) {
        case "axes":
          throw new LibraryValidationError([
            { path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN },
          ]);
        case "sections":
          await this.repo.deleteSection(id);
          break;
        case "recommendations":
          await this.repo.deleteRecommendation(id);
          break;
      }
      logInfo("library.item.deleted", {
        entity,
        itemId: id,
        actorUserId: context.userId ?? null,
      });
    } catch (error) {
      throwLibrarySupabaseError(error);
    }
  }


  async submitForReview(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    return this.lifecycle.submitForReview(entity, id, context);
  }

  async returnReview(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    return this.lifecycle.returnReview(entity, id, context);
  }

  async publish(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext & TransitionOptions = {},
  ): Promise<LibraryCatalogItem> {
    return this.lifecycle.publish(entity, id, context);
  }

  async deprecate(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext & TransitionOptions = {},
  ): Promise<LibraryCatalogItem> {
    return this.lifecycle.deprecate(entity, id, context);
  }

  async archive(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryServiceContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    return this.lifecycle.archive(entity, id, context);
  }

  async listVersions(entity: LibraryCatalogEntity, id: string) {
    const itemType: LibraryItemType = LIBRARY_ITEM_TYPE_BY_ENTITY[entity];
    return this.repo.listVersions(itemType, id);
  }
}
