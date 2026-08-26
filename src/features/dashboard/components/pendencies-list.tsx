import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { PendencyItem } from "@/features/dashboard/queries";
import { formSurface } from "@/shared/layout/form-surface";

const PENDENCY_STYLE = {
  badge: formSurface.badge.warning,
  label: "Atenção",
  iconWrap: "bg-amber-100 text-amber-700",
};

export function PendenciesList({ items }: { items: PendencyItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-base text-slate-600">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <span>Nenhuma pendência no momento.</span>
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const style = PENDENCY_STYLE;
        return (
          <li
            key={item.id}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-slate-300 hover:shadow-card-hover md:p-5"
          >
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span
                  className={`${formSurface.badge.base} ${style.badge} uppercase tracking-wide`}
                >
                  {style.label}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
            {item.href ? (
              <Link
                href={item.href}
                className={`${formSurface.secondaryButtonSm} shrink-0 self-center`}
              >
                Tratar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
