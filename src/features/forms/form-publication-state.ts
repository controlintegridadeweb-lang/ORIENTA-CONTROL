import "server-only";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

/**
 * Estado de PUBLICAÇÃO do formulário — derivado, nunca armazenado.
 *
 * No schema canônico `forms` não tem coluna `state`/`version`/`archived_at`:
 * o ciclo de vida pertence às `form_versions`. Este helper é a fonte ÚNICA da
 * derivação, para que páginas, rotas e serviços concordem.
 *
 * Mapeamento:
 *   - sem `current_form_version_id`         → "draft"  (nunca publicado)
 *   - form_versions.state = 'published'     → "published"
 *   - form_versions.state = 'superseded'    → "superseded"
 *   - form_versions.state = 'archived'      → "archived"
 *
 * "Editável" é intrínseco ao rascunho (`form_drafts`), não a um estado de
 * `forms`: o admin sempre edita o rascunho; publicar materializa uma versão
 * imutável. Por isso `isEditable` não depende do estado de publicação — um
 * formulário publicado continua tendo rascunho editável para a próxima versão.
 */

export type FormPublicationState =
  | "draft"
  | "published"
  | "superseded"
  | "archived";

export type FormPublicationInfo = {
  state: FormPublicationState;
  currentVersion: number | null;
  currentFormVersionId: string | null;
  publishedAt: string | null;
};

/**
 * Deriva o estado de publicação a partir de `forms.current_form_version_id`.
 * Uma única consulta a `form_versions` quando há versão corrente.
 */
export async function deriveFormPublicationState(
  supabase: TypedSupabaseClient,
  form: { current_form_version_id: string | null },
): Promise<FormPublicationInfo> {
  if (!form.current_form_version_id) {
    return {
      state: "draft",
      currentVersion: null,
      currentFormVersionId: null,
      publishedAt: null,
    };
  }

  const { data: version, error } = await supabase
    .from("form_versions")
    .select("id, version, state, published_at")
    .eq("id", form.current_form_version_id)
    .maybeSingle();
  if (error) throw error;

  // Ponteiro aponta para versão inexistente: trata como rascunho (defensivo).
  if (!version) {
    return {
      state: "draft",
      currentVersion: null,
      currentFormVersionId: null,
      publishedAt: null,
    };
  }

  return {
    state: version.state as FormPublicationState,
    currentVersion: version.version,
    currentFormVersionId: version.id,
    publishedAt: version.published_at ?? null,
  };
}
