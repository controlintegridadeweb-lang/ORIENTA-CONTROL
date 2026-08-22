import type { FormPublicationState } from "@/features/forms/form-publication-state";

/** Rótulos visíveis dos estados de publicação do formulário. */
const FORM_PUBLICATION_STATE_LABEL: Record<FormPublicationState, string> = {
  draft: "Rascunho",
  published: "Publicado",
  superseded: "Substituído",
  archived: "Arquivado",
};

/** Nunca retorna o enum técnico para a interface. */
export function formPublicationStateLabel(
  state: string | null | undefined,
): string {
  if (state && state in FORM_PUBLICATION_STATE_LABEL) {
    return FORM_PUBLICATION_STATE_LABEL[state as FormPublicationState];
  }
  return "Situação de publicação indisponível";
}
