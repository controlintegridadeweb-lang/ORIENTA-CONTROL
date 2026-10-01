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

const MENU_WIDTH = 240;
const MENU_GAP = 6;
const MENU_ITEM_HEIGHT = 36;
const MENU_CHROME = 8;
const VIEWPORT_PADDING = 8;

/**
 * Menu em `position: fixed`, no `document.body`, para não ser recortado
 * pelo `overflow` da tabela de ações. Abre para cima quando não cabe abaixo.
 */
export function actionPlanRowMenuFixedStyle(
  anchor: DOMRect,
  itemCount: number,
  viewport: Pick<Window, "innerWidth" | "innerHeight">,
): CSSProperties {
  const estimatedHeight = Math.max(1, itemCount) * MENU_ITEM_HEIGHT + MENU_CHROME;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, anchor.right - MENU_WIDTH),
    Math.max(VIEWPORT_PADDING, viewport.innerWidth - MENU_WIDTH - VIEWPORT_PADDING),
  );
  const spaceBelow = viewport.innerHeight - anchor.bottom - MENU_GAP;
  const spaceAbove = anchor.top - MENU_GAP;
  const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
  const available = Math.max(MENU_ITEM_HEIGHT, openUpward ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(estimatedHeight, available);

  const shared: CSSProperties = {
    position: "fixed",
    left,
    width: MENU_WIDTH,
    maxHeight,
    overflowY: maxHeight < estimatedHeight ? "auto" : "visible",
    zIndex: 80,
  };

  if (openUpward) {
    return {
      ...shared,
      bottom: viewport.innerHeight - anchor.top + MENU_GAP,
    };
  }

  return {
    ...shared,
    top: anchor.bottom + MENU_GAP,
  };
}

export function ActionPlanRowOptionsMenu({ actionLabel, items, disabled }: Props) {
  const [open, setOpen] = useState(false);
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

  if (items.length === 0) return <span className="text-slate-400">—</span>;

  const menu =
    open && anchor ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        style={actionPlanRowMenuFixedStyle(anchor, items.length, window)}
        className="rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
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
              className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
    ) : null;

  return (
    <div className="relative inline-flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        className={`${formSurface.secondaryButtonSm} bg-white`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Opções da ação ${actionLabel}`}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setAnchor(rect);
          setOpen(true);
        }}
      >
        ... Mais
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
