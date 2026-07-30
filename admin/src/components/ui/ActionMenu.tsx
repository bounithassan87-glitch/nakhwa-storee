import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ActionItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Shown as a native tooltip — use it to explain *why* an item is disabled. */
  title?: string;
}

const MENU_WIDTH = 208; // px — the panel is sized from this, not a Tailwind class
const GAP = 6;
const EDGE = 8; // minimum breathing room from the viewport edge

/**
 * Row-level actions dropdown.
 *
 * The panel is positioned `fixed` from the trigger's bounding box rather than
 * absolutely inside the row: the products table scrolls horizontally
 * (`overflow-x-auto`), which establishes a clipping context that would cut an
 * absolutely-positioned panel off. Fixed coordinates go stale once the page
 * moves, so any scroll or resize closes the menu.
 *
 * It is rendered through a portal into `document.body`, and that is load-bearing
 * rather than cosmetic: a `position: fixed` element resolves against the nearest
 * ancestor carrying a `transform` (or `filter` / `perspective` / `contain`), not
 * against the viewport. List rows animate in with a `translateY` that
 * `animation-fill-mode: both` leaves applied, so an in-tree panel was offset by
 * the row's own position — measured 374px down and 49px across. The portal keeps
 * the viewport as the containing block regardless of what an ancestor does.
 */
export function ActionMenu({ items, label = "إجراءات" }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // On first open the panel is not mounted yet, so estimate from the item count.
    const height = menuRef.current?.offsetHeight ?? items.length * 40 + 12;
    const below = window.innerHeight - rect.bottom;
    // Flip above the trigger when the panel would run past the viewport bottom.
    const top = below < height + GAP ? Math.max(EDGE, rect.top - height - GAP) : rect.bottom + GAP;

    // Prefer trailing-edge alignment (the panel grows toward the page centre).
    // In this RTL admin the actions column sits at the far left, so that
    // overflows — fall back to aligning on the trigger's leading edge instead of
    // slamming the panel against the viewport border.
    let left = rect.right - MENU_WIDTH;
    if (left < EDGE) left = rect.left;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - MENU_WIDTH - EDGE));

    setPos({ top, left });
  }, [items.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    const close = () => setOpen(false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    // `true` → capture, so scrolling any ancestor (not just the page) closes it.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-brand-soft hover:text-ink",
          open && "bg-brand-soft text-ink",
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-[75] animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-right shadow-[0_18px_45px_rgba(60,50,25,.20)]"
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                title={item.title}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold transition",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  item.tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-brand-soft",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
