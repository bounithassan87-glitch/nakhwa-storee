import { TrendingUp, ShoppingBag, Wallet, Percent } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

export default function Analytics() {
  return (
    <>
      <PageHeader title="الإحصائيات" subtitle="أداء المتجر والمبيعات" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي المبيعات" value="—" icon={Wallet} hint="قريباً" />
        <StatCard label="عدد الطلبات" value="—" icon={ShoppingBag} hint="قريباً" />
        <StatCard label="متوسط قيمة الطلب" value="—" icon={TrendingUp} hint="قريباً" />
        <StatCard label="معدل التحويل" value="—" icon={Percent} hint="قريباً" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink">المبيعات عبر الوقت</h3>
          <div className="grid h-56 place-items-center rounded-xl bg-brand-soft/40 text-sm text-muted">
            الرسم البياني — قريباً
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink">الأكثر مبيعاً</h3>
          <div className="grid h-56 place-items-center rounded-xl bg-brand-soft/40 text-sm text-muted">
            الرسم البياني — قريباً
          </div>
        </Card>
      </div>
    </>
  );
}
