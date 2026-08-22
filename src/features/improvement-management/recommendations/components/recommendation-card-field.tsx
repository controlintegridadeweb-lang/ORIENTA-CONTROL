import type { ElementType, ReactNode } from "react";
import {
  recommendationCardType,
  type RecommendationCardTextVariant,
} from "@/features/improvement-management/recommendations/components/recommendation-card-typography";

type RecommendationCardFieldProps = {
  id?: string;
  label: string;
  children: ReactNode;
  className?: string;
};

/** Campo rotulado: rótulo nível 1 + conteúdo tipado pelos filhos. */
export function RecommendationCardField({
  id,
  label,
  children,
  className = "",
}: RecommendationCardFieldProps) {
  return (
    <section aria-labelledby={id} className={`min-w-0 space-y-1.5 ${className}`.trim()}>
      <h4 id={id} className={recommendationCardType.label}>
        {label}
      </h4>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

type RecommendationCardTextProps = {
  variant?: RecommendationCardTextVariant;
  as?: ElementType;
  children: ReactNode;
  className?: string;
  preWrap?: boolean;
};

/**
 * Texto tipado do card — evita classes tipográficas ad hoc no JSX.
 * Use `highlight` apenas para o texto da recomendação.
 */
export function RecommendationCardText({
  variant = "body",
  as: Tag = "p",
  children,
  className = "",
  preWrap = false,
}: RecommendationCardTextProps) {
  const wrap = preWrap ? "whitespace-pre-wrap" : "";
  return (
    <Tag className={`${recommendationCardType[variant]} ${wrap} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
