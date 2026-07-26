import { useEffect, useState } from "react";
import { LogOut, Save, KeyRound, Monitor } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/auth/AuthContext";
import { updateProfile, changeOwnPassword } from "@/features/settings/api";
import { ROLE_LABEL } from "@/features/settings/permissions";
import { formatDate } from "@/lib/format";

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
  }, [user]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim() || null, avatarUrl: avatarUrl.trim() });
      await refresh();
      notify("تم حفظ الملف الشخصي");
    } catch {
      notify("تعذّر الحفظ");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    if (next.length < 8) return notify("كلمة المرور الجديدة ٨ أحرف على الأقل.");
    if (next !== confirm) return notify("كلمتا المرور غير متطابقتين.");
    setSavingPw(true);
    try {
      await changeOwnPassword(cur, next);
      setCur("");
      setNext("");
      setConfirm("");
      notify("تم تغيير كلمة المرور");
    } catch (e) {
      notify((e as Error).message === "invalid_current_password" ? "كلمة المرور الحالية غير صحيحة." : "تعذّر التغيير");
    } finally {
      setSavingPw(false);
    }
  }

  const roleLabel = ROLE_LABEL[user?.role ?? ""] ?? user?.role;

  return (
    <>
      <PageHeader title="الملف الشخصي" subtitle="بيانات حسابك" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Identity */}
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-[72px] w-[72px] rounded-full border border-line object-cover" />
          ) : (
            <Avatar name={user?.name || user?.email || "؟"} size={72} />
          )}
          <div>
            <p className="font-black text-ink">{user?.name || user?.email}</p>
            <p className="text-sm text-muted" dir="ltr">{user?.email}</p>
          </div>
          <Badge tone="brand">{roleLabel}</Badge>
          {user?.lastLoginAt && <p className="text-xs text-faint">آخر دخول: {formatDate(user.lastLoginAt)}</p>}
          <Button variant="danger" size="sm" className="mt-2 w-full" onClick={logout}>
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </Button>
        </Card>

        {/* Edit profile + password */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink">تعديل البيانات</h3>
              <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
                <Save className="h-4 w-4" /> {savingProfile ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="البريد الإلكتروني" value={user?.email ?? ""} disabled dir="ltr" />
              <Input label="رابط الصورة الرمزية" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} dir="ltr" placeholder="https://…" />
              <Input label="الدور" value={roleLabel ?? ""} disabled />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
              <KeyRound className="h-4 w-4 text-brand" /> تغيير كلمة المرور
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="كلمة المرور الحالية" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
              <Input label="كلمة المرور الجديدة" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              <Input label="تأكيد كلمة المرور" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="mt-4">
              <Button size="sm" onClick={savePassword} disabled={savingPw || !cur || !next}>
                {savingPw ? "جارٍ التغيير…" : "تحديث كلمة المرور"}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-ink">
              <Monitor className="h-4 w-4 text-brand" /> الجلسات النشطة
            </h3>
            <div className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-3 text-sm">
              <div>
                <p className="font-bold text-ink">الجلسة الحالية</p>
                <p className="text-xs text-muted">هذا المتصفح · جلسة آمنة عبر كوكي</p>
              </div>
              <Badge tone="success">نشطة</Badge>
            </div>
            <p className="mt-3 text-xs text-faint">
              إدارة جلسات متعددة الأجهزة ستتوفر لاحقاً (الجلسات حالياً بدون حالة عبر JWT).
            </p>
          </Card>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-sidebar px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
