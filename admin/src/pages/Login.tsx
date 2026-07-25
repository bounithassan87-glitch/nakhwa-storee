import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const [email, setEmail] = useState("owner@nakhwa.local");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await login(email, password);
    navigate(location.state?.from?.pathname ?? "/dashboard", { replace: true });
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-brand-soft/40 to-bg p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-[0_12px_40px_rgba(60,50,25,.12)]">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sidebar text-2xl font-black text-gold">
            ن
          </span>
          <h1 className="text-lg font-black text-ink">لوحة تحكم نخوى</h1>
          <p className="text-sm text-muted">سجّلي الدخول للمتابعة</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-faint">
          نسخة تجريبية — المصادقة غير مفعّلة بعد
        </p>
      </div>
    </div>
  );
}
