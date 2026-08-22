"use client";

import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { ChevronDown } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

export type ActionPlanRowMenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  actionLabel: string;
  items: ActionPlanRowMenuItem[];
  disabled?: boolean;
};

export function ActionPlanRowOptionsMenu({ actionLabel, items, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function closeWhenOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (items.length === 0) return <span className="text-slate-400">—</span>;

  return (
    <div ref={ref} className="relative inline-flex justify-center">
      <button
        type="button"
        className={`${formSurface.secondaryButtonSm} bg-white`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Opções da ação ${actionLabel}`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        ... Mais
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1.5 min-w-52 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isDanger = item.tone === "danger";
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDanger
                    ? "text-rose-700 hover:bg-rose-50"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
