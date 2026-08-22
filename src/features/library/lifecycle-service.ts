import { createHash } from "crypto";
import { LibraryRepository, type LibraryActorContext } from "./repository";
import { ESG_AXIS_MUTATION_FORBIDDEN } from "@/features/library/domain/fixed-axes";
import { getLibraryAudit } from "./audit";
import { logInfo } from "@/infrastructure/observability/logger";
import { LIBRARY_ITEM_TYPE_BY_ENTITY, type LibraryCatalogEntity, type LibraryCatalogItem, type LibraryItemStatus } from "./types";
import { LibraryValidationError } from "./errors";
import { loadRequiredLibraryItem } from "./catalog-item-loader";
import { LIBRARY_STATUS_LABEL } from "./config";

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


function versionedTableFor(entity: LibraryCatalogEntity): VersionedLibraryTable {
  if (entity === "axes") {
    throw new LibraryValidationError([{ path: "_", message: ESG_AXIS_MUTATION_FORBIDDEN }]);
  }
  return VERSIONED_TABLE_BY_ENTITY[entity];
}

function deterministicHash(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of keys) {
    normalized[key] = payload[key];
  }
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export type TransitionOptions = {
  justification?: string | null;
  reviewerUserId?: string | null;
};

const VALID_TRANSITIONS: Record<LibraryItemStatus, LibraryItemStatus[]> = {
  draft: ["in_review", "published", "archived"],
  in_review: ["draft", "published"],
  published: ["deprecated"],
  deprecated: ["archived"],
  archived: [],
};

function assertTransition(from: LibraryItemStatus, to: LibraryItemStatus) {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new LibraryValidationError([
      {
        path: "status",
        message: `Não é possível alterar o item de ${LIBRARY_STATUS_LABEL[from]} para ${LIBRARY_STATUS_LABEL[to]}.`,
      },
    ]);
  }
}


export class LibraryLifecycleService {
  constructor(private readonly repo: LibraryRepository) {}


  async submitForReview(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryActorContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    const item = await loadRequiredLibraryItem(this.repo, entity, id);
    assertTransition(item.status, "in_review");
    await this.repo.updateItemStatus(versionedTableFor(entity), id, {
      status: "in_review",
      updated_by: context.userId ?? null,
    });
    logInfo("library.item.submitted_to_review", {
      entity,
      itemId: id,
      actorUserId: context.userId ?? null,
      justification: context.justification ?? null,
    });
    void getLibraryAudit().record({
      action: "submitted_to_review",
      entity,
      itemType: LIBRARY_ITEM_TYPE_BY_ENTITY[entity],
      itemId: id,
      actorUserId: context.userId ?? null,
      fromStatus: item.status,
      toStatus: "in_review",
      justification: context.justification ?? null,
    });
    return loadRequiredLibraryItem(this.repo, entity, id);
  }

  async returnReview(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryActorContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    const item = await loadRequiredLibraryItem(this.repo, entity, id);
    assertTransition(item.status, "draft");
    await this.repo.updateItemStatus(versionedTableFor(entity), id, {
      status: "draft",
      updated_by: context.userId ?? null,
    });
    logInfo("library.item.review_returned", {
      entity,
      itemId: id,
      actorUserId: context.userId ?? null,
      justification: context.justification ?? null,
    });
    void getLibraryAudit().record({
      action: "review_returned",
      entity,
      itemType: LIBRARY_ITEM_TYPE_BY_ENTITY[entity],
      itemId: id,
      actorUserId: context.userId ?? null,
      fromStatus: item.status,
      toStatus: "draft",
      justification: context.justification ?? null,
    });
    return loadRequiredLibraryItem(this.repo, entity, id);
  }

  async publish(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryActorContext & TransitionOptions = {},
  ): Promise<LibraryCatalogItem> {
    const current = await loadRequiredLibraryItem(this.repo, entity, id);
    assertTransition(current.status, "published");

    const justification = context.justification?.trim() ?? null;
    const now = new Date().toISOString();
    await this.repo.updateItemStatus(versionedTableFor(entity), id, {
      status: "published",
      approved_by: context.reviewerUserId ?? context.userId ?? null,
      approved_at: now,
      vigente_de: now,
      updated_by: context.userId ?? null,
    });

    const published = await loadRequiredLibraryItem(this.repo, entity, id);
    const itemType = LIBRARY_ITEM_TYPE_BY_ENTITY[entity];
    const payload: Record<string, unknown> = Object.fromEntries(Object.entries(published));
    const hash = deterministicHash(payload);

    const previous = await this.repo.findLatestVersion(itemType, id);
    if (previous) {
      await this.repo.closeVersion(previous.id, context.userId ?? null);
    }

    await this.repo.insertItemVersion({
      itemType,
      itemId: id,
      version: published.version,
      versionMajor: published.versionMajor,
      versionMinor: published.versionMinor,
      versionPatch: published.versionPatch,
      payload,
      hash,
      vigenteDe: now,
      previousVersionId: previous?.id ?? null,
      publishedBy: context.userId ?? null,
    });

    logInfo("library.item.published", {
      entity,
      itemId: id,
      version: published.version,
      actorUserId: context.userId ?? null,
      justification: context.justification,
    });
    void getLibraryAudit().record({
      action: "published",
      entity,
      itemType,
      itemId: id,
      actorUserId: context.userId ?? null,
      fromStatus: current.status,
      toStatus: "published",
      fromVersion: previous ? previous.version : null,
      toVersion: published.version,
      justification,
      hash,
    });
    return published;
  }

  async deprecate(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryActorContext & TransitionOptions = {},
  ): Promise<LibraryCatalogItem> {
    const item = await loadRequiredLibraryItem(this.repo, entity, id);
    assertTransition(item.status, "deprecated");
    if (!context.justification || context.justification.trim().length < 5) {
      throw new LibraryValidationError([
        { path: "justification", message: "Justificativa de descontinuação obrigatória." },
      ]);
    }
    const now = new Date().toISOString();
    await this.repo.updateItemStatus(versionedTableFor(entity), id, {
      status: "deprecated",
      deprecated_by: context.userId ?? null,
      deprecated_at: now,
      vigente_ate: now,
      updated_by: context.userId ?? null,
    });
    logInfo("library.item.deprecated", {
      entity,
      itemId: id,
      actorUserId: context.userId ?? null,
      justification: context.justification,
    });
    void getLibraryAudit().record({
      action: "deprecated",
      entity,
      itemType: LIBRARY_ITEM_TYPE_BY_ENTITY[entity],
      itemId: id,
      actorUserId: context.userId ?? null,
      fromStatus: item.status,
      toStatus: "deprecated",
      fromVersion: item.version,
      toVersion: item.version,
      justification: context.justification,
    });
    return loadRequiredLibraryItem(this.repo, entity, id);
  }

  async archive(
    entity: LibraryCatalogEntity,
    id: string,
    context: LibraryActorContext & { justification?: string | null } = {},
  ): Promise<LibraryCatalogItem> {
    const item = await loadRequiredLibraryItem(this.repo, entity, id);
    assertTransition(item.status, "archived");
    await this.repo.updateItemStatus(versionedTableFor(entity), id, {
      status: "archived",
      updated_by: context.userId ?? null,
    });
    logInfo("library.item.archived", {
      entity,
      itemId: id,
      actorUserId: context.userId ?? null,
      justification: context.justification ?? null,
    });
    void getLibraryAudit().record({
      action: "archived",
      entity,
      itemType: LIBRARY_ITEM_TYPE_BY_ENTITY[entity],
      itemId: id,
      actorUserId: context.userId ?? null,
      fromStatus: item.status,
      toStatus: "archived",
      justification: context.justification ?? null,
    });
    return loadRequiredLibraryItem(this.repo, entity, id);
  }

}
