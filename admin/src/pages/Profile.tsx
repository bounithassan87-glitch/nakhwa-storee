import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/auth/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <>
      <PageHeader title="الملف الشخصي" subtitle="بيانات حسابك" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <Avatar name={user?.name ?? "؟"} size={72} />
          <div>
            <p className="font-black text-ink">{user?.name}</p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
          <Badge tone="brand">{user?.role === "owner" ? "المالك" : user?.role}</Badge>
          <Button variant="danger" size="sm" className="mt-2 w-full" onClick={logout}>
            <LogOut className="h-4 w-4" /> تسجيل الخروج
          </Button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-bold text-ink">تعديل البيانات</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="الاسم" defaultValue={user?.name} disabled />
            <Input label="البريد الإلكتروني" defaultValue={user?.email} disabled />
            <Input label="كلمة المرور الجديدة" type="password" placeholder="••••••••" disabled />
            <Input label="تأكيد كلمة المرور" type="password" placeholder="••••••••" disabled />
          </div>
          <div className="mt-4">
            <Button size="sm" disabled>
              حفظ
            </Button>
          </div>
          <p className="mt-3 text-xs text-faint">
            التعديل غير مفعّل بعد — سيُربط بالمصادقة الحقيقية لاحقاً.
          </p>
        </Card>
      </div>
    </>
  );
}
