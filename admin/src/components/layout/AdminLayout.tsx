import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { NotificationsProvider } from "@/features/notifications/NotificationsContext";
import { ToastHost } from "@/features/notifications/ToastHost";
import { PushStatusBanner } from "@/features/notifications/PushStatusBanner";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <NotificationsProvider>
    <div className="flex h-full">
      {/* Desktop sidebar — sits on the right in RTL */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/*
        Mobile drawer.

        The panel is anchored with `start-0` — the *right* edge under `dir="rtl"`
        — because `translate-x-full` is physical: it always moves the element
        right. Anchored at `end-0` (the left edge in RTL) the closed state slid
        the panel rightwards *into* the viewport instead of out of it, leaving
        134px of sidebar painted over the page at 390px and 256px at 768px.
        Right edge + rightward translate is the pairing that actually hides it,
        and it puts the drawer on the same side as the desktop sidebar.

        `overflow-hidden` keeps the off-screen panel from extending the
        scrollable area while it is parked outside the viewport.
      */}
      <div
        className={cn(
          "fixed inset-0 z-40 overflow-hidden lg:hidden",
          open ? "" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 start-0 transition-transform duration-300",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setOpen(true)} />
        {/* Sits above the scroll area so the reason push is not working is
            seen on arrival, not scrolled past. Renders nothing once it is. */}
        <PushStatusBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><Spinner className="h-7 w-7 text-brand" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ToastHost />
    </div>
    </NotificationsProvider>
  );
}
