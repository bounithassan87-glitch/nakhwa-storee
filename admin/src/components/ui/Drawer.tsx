import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-50 overflow-hidden", open ? "" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      {/*
        Anchored `start-0` — the right edge under `dir="rtl"` — to match the
        physical direction of `translate-x-full`. At `end-0` (the left edge in
        RTL) the closed panel translated rightwards into view: harmless while
        `w-full` capped it at the viewport width, but from 448px up it left a
        320px slab of the drawer painted over the page.
      */}
      <div
        className={cn(
          "absolute inset-y-0 start-0 flex w-full max-w-md flex-col bg-surface shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-black text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
