import { Menu, Search, LogOut, Bell, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { Avatar } from "@/components/ui/Avatar";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { newCount, soundEnabled, setSoundEnabled, markAllSeen } = useNotifications();
  const navigate = useNavigate();
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

      <div className="ms-auto flex items-center gap-2 sm:gap-3">
        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-brand-soft"
          aria-label={soundEnabled ? "كتم صوت التنبيهات" : "تفعيل صوت التنبيهات"}
          title={soundEnabled ? "صوت التنبيهات مفعّل" : "صوت التنبيهات مكتوم"}
        >
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>

        {/* New-orders bell */}
        <button
          onClick={() => {
            markAllSeen();
            navigate("/orders");
          }}
          className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-brand-soft"
          aria-label={newCount > 0 ? `${newCount} طلبات جديدة` : "التنبيهات"}
          title="الطلبات الجديدة"
        >
          <Bell className="h-5 w-5" />
          {newCount > 0 && (
            <span className="absolute -top-1 end-0 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-black leading-4 text-white">
              {newCount > 99 ? "99+" : newCount}
            </span>
          )}
        </button>

        <div className="hidden text-start sm:block">
          <p className="text-sm font-bold text-ink">{user?.email}</p>
          <p className="text-xs text-muted">{user?.role === "owner" ? "المالك" : user?.role}</p>
        </div>
        <Avatar name={user?.email ?? "؟"} />
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
