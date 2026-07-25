import { Menu, Search, LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur md:px-6">
      <button
        onClick={onMenu}
        className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-brand-soft lg:hidden"
        aria-label="القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden flex-1 md:block">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          placeholder="بحث…"
          disabled
          className="h-10 w-full max-w-md rounded-xl border border-line bg-bg pe-10 ps-4 text-sm outline-none placeholder:text-faint"
        />
      </div>

      <div className="ms-auto flex items-center gap-3">
        <div className="hidden text-start sm:block">
          <p className="text-sm font-bold text-ink">{user?.name}</p>
          <p className="text-xs text-muted">{user?.email}</p>
        </div>
        <Avatar name={user?.name ?? "؟"} />
        <button
          onClick={logout}
          className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
