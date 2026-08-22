import { typography } from "@/shared/layout/design-system";

export function OverviewContentBlock({
  title,
  description,
  children,
  borderedTop = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  borderedTop?: boolean;
}) {
  return (
    <section
      className={`space-y-2.5 ${borderedTop ? "border-t border-slate-100/90 pt-5" : ""}`.trim()}
    >
      <div>
        <h3 className={typography.cardTitle}>{title}</h3>
        {description ? <p className={`mt-0.5 ${typography.meta}`}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
