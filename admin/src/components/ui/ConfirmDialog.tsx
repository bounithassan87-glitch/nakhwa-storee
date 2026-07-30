import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

/**
 * Reusable confirmation modal for destructive or irreversible actions.
 *
 * Mirrors `Drawer`'s conventions (Escape to close, backdrop click, `role`/
 * `aria-modal`) so the two behave alike, and moves focus to the confirm button
 * on open — a keyboard user can accept or cancel without reaching for a mouse.
 * Colours come from theme tokens only, so it follows any future dark palette.
 *
 * Rendered through a portal so its `fixed inset-0` overlay always covers the
 * viewport: a `transform` on any ancestor would otherwise make it the
 * containing block and shrink the overlay to that element's box.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
      />

      <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-line bg-surface p-6 text-right shadow-[0_24px_60px_rgba(0,0,0,.25)]">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
              tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-dark",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-ink">{title}</h2>
            {description && <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>}
          </div>
        </div>

        <div className="mt-6 flex justify-start gap-2">
          {/* The dialog only mounts while open, so `autoFocus` lands focus on
              the confirm action each time it appears — without needing `Button`
              to forward a ref. */}
          <Button
            autoFocus
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
