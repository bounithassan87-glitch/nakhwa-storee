import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-white/90">
      <div className="flex items-center gap-3 px-6 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold font-black text-sidebar">
          ن
        </span>
        <div>
          <p className="text-sm font-black text-white">Nakhwa</p>
          <p className="text-xs text-white/50">لوحة التحكم</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 text-xs text-white/40">الإصدار 0.1 — تجريبي</div>
    </aside>
  );
}
