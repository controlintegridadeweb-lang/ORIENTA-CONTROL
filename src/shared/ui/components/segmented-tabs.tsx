"use client";

type SegmentTab<T extends string> = {
  id: T;
  label: string;
  /** Tooltip (title nativo). */
  title?: string;
};

const tabClasses = (selected: boolean) =>
  selected
    ? "bg-brand text-white shadow-sm"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

const SIZE_CLASS = {
  md: {
    list: "gap-1",
    tab: "min-h-10 rounded-lg px-4 py-2 text-sm font-medium",
    card: "rounded-xl p-1",
  },
  lg: {
    list: "gap-1.5",
    tab: "min-h-12 rounded-xl px-5 py-2.5 text-base font-semibold",
    card: "rounded-2xl p-1.5",
  },
} as const;

type SegmentedTabsProps<T extends string> = {
  "aria-label": string;
  items: SegmentTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /**
   * `card` — contorno branco tipo barra elevada (Biblioteca, Plano de integridade e compliance).
   * `bare` — apenas tablist para embutir em faixa pai (ex.: FAMI).
   */
  variant?: "card" | "bare";
  /** Escala visual das abas. */
  size?: keyof typeof SIZE_CLASS;
};

/**
 * Troca de vistas no mesmo cliente; ativo sempre com acento de marca (token `brand`).
 */
export function SegmentedTabs<T extends string>({
  "aria-label": ariaLabel,
  items,
  value,
  onChange,
  variant = "card",
  size = "md",
}: SegmentedTabsProps<T>) {
  const scale = SIZE_CLASS[size];

  const inner = (
    <div className={`flex flex-wrap ${scale.list}`} role="group" aria-label={ariaLabel}>
      {items.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={String(tab.id)}
            type="button"
            aria-pressed={selected}
            aria-label={tab.title ? `${tab.label}. ${tab.title}` : tab.label}
            onClick={() => onChange(tab.id)}
            className={`transition ${scale.tab} ${tabClasses(selected)}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  if (variant === "bare") {
    return inner;
  }

  return (
    <div className={`border border-slate-200 bg-white shadow-sm ${scale.card}`}>
      {inner}
    </div>
  );
}
