import type { FormPublicationState } from "@/features/forms/form-publication-state";
import { formPublicationStateLabel } from "@/features/forms/form-publication-labels";
import { formSurface } from "@/shared/layout/form-surface";
import { StatusPill } from "@/shared/ui/components/status-pill";

const BADGE_VARIANT: Record<
  FormPublicationState,
  Exclude<keyof typeof formSurface.badge, "base">
> = {
  draft: "neutral",
  published: "brand",
  superseded: "muted",
  archived: "neutral",
};

type Props = {
  state: FormPublicationState;
  size?: "sm" | "md";
};

/** Selo de publicação do formulário; não deve ser usado para estado do diagnóstico. */
export function FormPublicationStateBadge({ state, size = "md" }: Props) {
  const variant = BADGE_VARIANT[state] ?? "neutral";
  const label = formPublicationStateLabel(state);

  return (
    <StatusPill
      className={`${formSurface.badge[variant]} ${size === "md" ? "min-h-7 px-2.5" : ""}`}
      aria-label={`Situação da publicação: ${label}`}
    >
      {label}
    </StatusPill>
  );
}
