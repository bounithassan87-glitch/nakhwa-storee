import { ShoppingBag, Users, Package, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DashboardHome() {
  return (
    <>
      <PageHeader title="لوحة القيادة" subtitle="نظرة عامة على المتجر" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="الطلبات اليوم" value="—" icon={ShoppingBag} hint="لا توجد بيانات بعد" />
        <StatCard label="المداخيل" value="—" icon={Wallet} hint="لا توجد بيانات بعد" />
        <StatCard label="الزبناء" value="—" icon={Users} hint="لا توجد بيانات بعد" />
        <StatCard label="المنتجات" value="—" icon={Package} hint="لا توجد بيانات بعد" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-1 font-bold text-ink">آخر الطلبات</h3>
          <EmptyState
            icon={ShoppingBag}
            title="لا توجد طلبات بعد"
            description="ستظهر الطلبات هنا بمجرد ربط اللوحة بقاعدة البيانات."
          />
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-ink">المبيعات</h3>
          <div className="grid h-48 place-items-center rounded-xl bg-brand-soft/40 text-sm text-muted">
            الرسم البياني — قريباً
          </div>
        </Card>
      </div>
    </>
  );
}
