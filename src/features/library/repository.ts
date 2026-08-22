import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import type {
  LibraryAxis,
  LibraryCatalogSnapshot,
  LibraryItemVersion,
  LibraryRecommendationBase,
  LibrarySection,
  LibraryItemType,
  LibraryCatalogEntity,
  LibraryCatalogItem,
} from "./types";
import type {
  LibraryAxisInput,
  LibraryRecommendationInput,
  LibrarySectionInput,
} from "./schemas";
import { ESG_AXIS_MUTATION_FORBIDDEN, mapFixedAxisRow } from "@/features/library/domain/fixed-axes";
import {
  SECTIONS_AXIS_FK,
  SECTIONS_TABLE,
  commonInsertPayload,
  commonUpdatePayload,
  mapItemVersion,
  mapRecommendation,
  mapSection,
  type ItemVersionRow,
  type LibraryActorContext,
  type RecommendationRow,
  type SectionRow,
  type VersionedLibraryTable,
} from "./repository-mappers";

export type { LibraryActorContext, VersionedLibraryTable } from "./repository-mappers";

type Client = SupabaseClient;

export class LibraryRepository {
  private supabase: Client;

  constructor(client?: Client) {
    this.supabase = client ?? createSupabaseServiceRoleClient();
  }

  async listAxes(): Promise<LibraryAxis[]> {
    const { data, error } = await this.supabase
      .from("axes")
      .select("id, name")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row, index) =>
      mapFixedAxisRow(row as { id: string; name: string }, index),
    );
  }

  async listSections(): Promise<LibrarySection[]> {
    const { data, error } = await this.supabase
      .from(SECTIONS_TABLE)
      .select(`*, ${SECTIONS_AXIS_FK}`)
      .order("ordem", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapSection(row as SectionRow));
  }

  async listRecommendations(): Promise<LibraryRecommendationBase[]> {
    const { data, error } = await this.supabase
      .from("library_recommendations")
      .select("*")
      .order("code", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapRecommendation(row as RecommendationRow));
  }

  /** Biblioteca Geral (admin): eixos fixos, seções e recomendações-base. */
  async snapshotCatalog(): Promise<LibraryCatalogSnapshot> {
    const [axes, sections, recommendations] = await Promise.all([
      this.listAxes(),
      this.listSections(),
      this.listRecommendations(),
    ]);
    return { axes, sections, recommendations };
  }


  async findAxis(id: string): Promise<LibraryAxis | null> {
    const { data, error } = await this.supabase
      .from("axes")
      .select("id, name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapFixedAxisRow(data as { id: string; name: string }, 0) : null;
  }

  async findSection(id: string): Promise<LibrarySection | null> {
    const { data, error } = await this.supabase
      .from(SECTIONS_TABLE)
      .select(`*, ${SECTIONS_AXIS_FK}`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSection(data as SectionRow) : null;
  }

  async findRecommendation(id: string): Promise<LibraryRecommendationBase | null> {
    const { data, error } = await this.supabase
      .from("library_recommendations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRecommendation(data as RecommendationRow) : null;
  }

  async findCatalogItem(
    entity: LibraryCatalogEntity,
    id: string,
  ): Promise<LibraryCatalogItem | null> {
    switch (entity) {
      case "axes":
        return this.findAxis(id);
      case "sections":
        return this.findSection(id);
      case "recommendations":
        return this.findRecommendation(id);
    }
  }

  async createAxis(_input: LibraryAxisInput, _actor: LibraryActorContext = {}): Promise<LibraryAxis> {
    throw new Error(ESG_AXIS_MUTATION_FORBIDDEN);
  }

  async updateAxis(
    _id: string,
    _input: LibraryAxisInput,
    _actor: LibraryActorContext = {},
  ): Promise<LibraryAxis> {
    throw new Error(ESG_AXIS_MUTATION_FORBIDDEN);
  }

  async deleteAxis(_id: string): Promise<void> {
    throw new Error(ESG_AXIS_MUTATION_FORBIDDEN);
  }

  async createSection(
    input: LibrarySectionInput,
    actor: LibraryActorContext = {},
  ): Promise<LibrarySection> {
    const payload = {
      axis_id: input.axisId,
      code: input.code,
      name: input.name,
      description: input.description,
      ordem: input.ordem,
      ...commonInsertPayload(input, actor.userId),
    };
    const { data, error } = await this.supabase
      .from(SECTIONS_TABLE)
      .insert(payload)
      .select(`*, ${SECTIONS_AXIS_FK}`)
      .single();
    if (error) throw error;
    return mapSection(data as SectionRow);
  }

  async updateSection(
    id: string,
    input: LibrarySectionInput,
    actor: LibraryActorContext = {},
  ): Promise<LibrarySection> {
    const payload = {
      axis_id: input.axisId,
      code: input.code,
      name: input.name,
      description: input.description,
      ordem: input.ordem,
      ...commonUpdatePayload(input, actor.userId),
    };
    const { data, error } = await this.supabase
      .from(SECTIONS_TABLE)
      .update(payload)
      .eq("id", id)
      .select(`*, ${SECTIONS_AXIS_FK}`)
      .single();
    if (error) throw error;
    return mapSection(data as SectionRow);
  }

  async deleteSection(id: string): Promise<void> {
    const { error } = await this.supabase.from(SECTIONS_TABLE).delete().eq("id", id);
    if (error) throw error;
  }

  async createRecommendation(
    input: LibraryRecommendationInput,
    actor: LibraryActorContext = {},
  ): Promise<LibraryRecommendationBase> {
    const payload = {
      code: input.code,
      title: input.title,
      description: input.description,
      tipo: input.tipo ?? "nao_implementacao",
      texto_base_fixo: input.textoBaseFixo,
      texto_base_parametrizavel: input.textoBaseParametrizavel,
      variaveis_parametro: input.variaveisParametro ?? [],
      fundamento_tecnico: input.fundamentoTecnico,
      escopo_aplicacao: input.escopoAplicacao,
      ...commonInsertPayload(input, actor.userId),
    };
    const { data, error } = await this.supabase
      .from("library_recommendations")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return mapRecommendation(data as RecommendationRow);
  }

  async updateRecommendation(
    id: string,
    input: LibraryRecommendationInput,
    actor: LibraryActorContext = {},
  ): Promise<LibraryRecommendationBase> {
    const payload = {
      code: input.code,
      title: input.title,
      description: input.description,
      tipo: input.tipo ?? "nao_implementacao",
      texto_base_fixo: input.textoBaseFixo,
      texto_base_parametrizavel: input.textoBaseParametrizavel,
      variaveis_parametro: input.variaveisParametro ?? [],
      fundamento_tecnico: input.fundamentoTecnico,
      escopo_aplicacao: input.escopoAplicacao,
      ...commonUpdatePayload(input, actor.userId),
    };
    const { data, error } = await this.supabase
      .from("library_recommendations")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapRecommendation(data as RecommendationRow);
  }

  async deleteRecommendation(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("library_recommendations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async updateItemStatus(
    tableName: VersionedLibraryTable,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase.from(tableName).update(patch).eq("id", id);
    if (error) throw error;
  }

  async insertItemVersion(payload: {
    itemType: LibraryItemType;
    itemId: string;
    version: string;
    versionMajor: number;
    versionMinor: number;
    versionPatch: number;
    payload: Record<string, unknown>;
    hash: string;
    vigenteDe: string;
    previousVersionId: string | null;
    publishedBy: string | null;
  }): Promise<LibraryItemVersion> {
    const insertPayload = {
      item_type: payload.itemType,
      item_id: payload.itemId,
      version: payload.version,
      version_major: payload.versionMajor,
      version_minor: payload.versionMinor,
      version_patch: payload.versionPatch,
      payload: payload.payload,
      hash: payload.hash,
      vigente_de: payload.vigenteDe,
      previous_version_id: payload.previousVersionId,
      published_by: payload.publishedBy,
    };
    const { data, error } = await this.supabase
      .from("library_item_versions")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw error;
    return mapItemVersion(data as ItemVersionRow);
  }

  async findVersionById(versionId: string): Promise<LibraryItemVersion | null> {
    const { data, error } = await this.supabase
      .from("library_item_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapItemVersion(data as ItemVersionRow) : null;
  }

  async findLatestVersion(
    itemType: LibraryItemType,
    itemId: string,
  ): Promise<LibraryItemVersion | null> {
    const { data, error } = await this.supabase
      .from("library_item_versions")
      .select("*")
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .order("published_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const [row] = data ?? [];
    return row ? mapItemVersion(row as ItemVersionRow) : null;
  }

  async findLatestVersionsByItemIds(
    itemType: LibraryItemType,
    itemIds: string[],
  ): Promise<Map<string, LibraryItemVersion>> {
    const map = new Map<string, LibraryItemVersion>();
    const unique = Array.from(new Set(itemIds)).filter(Boolean);
    if (unique.length === 0) return map;
    const { data, error } = await this.supabase
      .from("library_item_versions")
      .select("*")
      .eq("item_type", itemType)
      .in("item_id", unique)
      .order("published_at", { ascending: false });
    if (error) throw error;
    for (const row of data ?? []) {
      const mapped = mapItemVersion(row as ItemVersionRow);
      if (!map.has(mapped.itemId)) map.set(mapped.itemId, mapped);
    }
    return map;
  }

  async listVersions(
    itemType: LibraryItemType,
    itemId: string,
  ): Promise<LibraryItemVersion[]> {
    const { data, error } = await this.supabase
      .from("library_item_versions")
      .select("*")
      .eq("item_type", itemType)
      .eq("item_id", itemId)
      .order("published_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapItemVersion(row as ItemVersionRow));
  }

  async closeVersion(versionId: string, deprecatedBy: string | null): Promise<void> {
    const { error } = await this.supabase
      .from("library_item_versions")
      .update({
        vigente_ate: new Date().toISOString(),
        deprecated_by: deprecatedBy,
        deprecated_at: new Date().toISOString(),
      })
      .eq("id", versionId);
    if (error) throw error;
  }

  async nextOrdemForAxes(): Promise<number> {
    return 0;
  }

  async nextOrdemForSectionsByAxis(axisId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(SECTIONS_TABLE)
      .select("ordem")
      .eq("axis_id", axisId)
      .order("ordem", { ascending: false })
      .limit(1);
    if (error) throw error;
    const current = data?.[0]?.ordem;
    return typeof current === "number" ? current + 1 : 0;
  }

  async isCodeTaken(table: VersionedLibraryTable, code: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(table)
      .select("id")
      .eq("code", code)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
}
