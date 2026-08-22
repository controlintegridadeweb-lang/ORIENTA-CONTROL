"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

export type ExportMenuOption<TFormat extends string> = {
  format: TFormat;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  hint: string;
};

type Props<TFormat extends string> = {
  options: Array<ExportMenuOption<TFormat>>;
  onExport: (format: TFormat) => Promise<void>;
  disabled?: boolean;
  label?: string;
};

const MENU_WIDTH = 288;
const MENU_GAP = 8;
const MENU_MIN_SPACE = 200;

/** Posiciona o menu em `position: fixed` para não ser recortado por `overflow-hidden` do herói. */
export function exportMenuFixedStyle(
  anchor: DOMRect,
  viewport: Pick<Window, "innerWidth" | "innerHeight">,
): CSSProperties {
  const left = Math.min(
    Math.max(8, anchor.right - MENU_WIDTH),
    Math.max(8, viewport.innerWidth - MENU_WIDTH - 8),
  );
  const spaceBelow = viewport.innerHeight - anchor.bottom - MENU_GAP;
  const spaceAbove = anchor.top - MENU_GAP;
  const openUpward = spaceBelow < MENU_MIN_SPACE && spaceAbove > spaceBelow;

  if (openUpward) {
    return {
      position: "fixed",
      left,
      width: MENU_WIDTH,
      bottom: viewport.innerHeight - anchor.top + MENU_GAP,
      zIndex: 80,
    };
  }

  return {
    position: "fixed",
    left,
    width: MENU_WIDTH,
    top: anchor.bottom + MENU_GAP,
    zIndex: 80,
  };
}

export function ExportMenu<TFormat extends string>({
  options,
  onExport,
  disabled,
  label = "Exportar",
}: Props<TFormat>) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TFormat | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function syncAnchor(): void {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  }

  useEffect(() => {
    if (!open) return;
    syncAnchor();
    function onReposition(): void {
      syncAnchor();
    }
    function closeWhenOutside(event: MouseEvent): void {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function handleExport(format: TFormat): Promise<void> {
    setOpen(false);
    setPending(format);
    try {
      await onExport(format);
    } finally {
      setPending(null);
    }
  }

  const menu =
    open && anchor ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={label}
        style={exportMenuFixedStyle(anchor, window)}
        className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-slate-100"
      >
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              disabled={pending !== null}
              onClick={() => void handleExport(option.format)}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className={formSurface.secondaryButtonSm}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setAnchor(rect);
          setOpen(true);
        }}
        disabled={disabled || pending !== null}
      >
        <Download className="h-4 w-4" aria-hidden />
        {label}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
