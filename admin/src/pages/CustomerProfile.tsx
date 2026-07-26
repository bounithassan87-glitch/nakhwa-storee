import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowRight,
  ShoppingBag,
  Wallet,
  Calculator,
  CheckCircle2,
  XCircle,
  MapPin,
  CalendarDays,
  AlertCircle,
  UserX,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderActions } from "@/features/orders/components/OrderActions";
import { STATUS_META } from "@/features/orders/status";
import { CustomerTagBadge } from "@/features/customers/components/CustomerTagBadge";
import { CustomerNotes } from "@/features/customers/components/CustomerNotes";
import { TAG_META } from "@/features/customers/tags";
import { useCustomer } from "@/features/customers/useCustomer";
import { formatMoney, formatDate, formatDateOnly } from "@/lib/format";

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customer, loading, error, notFound, refetch } = useCustomer(id);

  const back = (
    <Link
      to="/customers"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"
    >
      <ArrowRight className="h-4 w-4" /> رجوع إلى الزبناء
    </Link>
  );

  if (loading) {
    return (
      <>
        {back}
        <div className="grid place-items-center gap-3 py-20 text-muted">
          <Spinner className="h-7 w-7 text-brand" />
          <span className="text-sm">جارٍ التحميل…</span>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        {back}
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={UserX}
            title="الزبون غير موجود"
            description="ربما تم حذف هذا الزبون أو أن الرابط غير صحيح."
            action={<Button onClick={() => navigate("/customers")}>عودة للائحة</Button>}
          />
        </div>
      </>
    );
  }

  if (error || !customer) {
    return (
      <>
        {back}
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={AlertCircle}
            title="حدث خطأ"
            description={error ?? "تعذّر تحميل بيانات الزبون."}
            action={<Button onClick={refetch}>إعادة المحاولة</Button>}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {back}

      {/* Identity header */}
      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={customer.fullName} size={64} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-black text-ink">{customer.fullName}</h2>
                <CustomerTagBadge tag={customer.tag} />
              </div>
              <p className="mt-1 text-sm text-muted" dir="ltr">{customer.phone}</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5" /> {customer.city} — {customer.address}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <OrderActions phone={customer.phone} />
            <p className="flex items-center gap-1 text-xs text-faint">
              <CalendarDays className="h-3.5 w-3.5" /> زبون منذ {formatDateOnly(customer.createdAt)}
            </p>
          </div>
        </div>
        <p className="mt-3 border-t border-line/60 pt-3 text-xs text-faint">
          {TAG_META[customer.tag].label}: {TAG_META[customer.tag].hint}
        </p>
      </Card>

      {/* Stats */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="إجمالي الطلبات" value={String(customer.totalOrders)} icon={ShoppingBag} />
        <StatCard label="إجمالي الإيراد" value={formatMoney(customer.totalRevenue)} icon={Wallet} />
        <StatCard label="متوسط قيمة الطلب" value={formatMoney(customer.avgOrderValue)} icon={Calculator} />
        <StatCard label="طلبات مسلَّمة" value={String(customer.delivered)} icon={CheckCircle2} />
        <StatCard label="طلبات ملغاة" value={String(customer.cancelled)} icon={XCircle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Order history */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-bold text-ink">سجل الطلبات</h3>
              <span className="text-xs text-muted">
                أول طلب {formatDateOnly(customer.firstOrderDate)} · آخر طلب{" "}
                {formatDateOnly(customer.lastOrderDate)}
              </span>
            </div>
            {customer.orders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="لا توجد طلبات" description="لم يقم هذا الزبون بأي طلب بعد." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-line bg-brand-soft/40 text-muted">
                      <th className="whitespace-nowrap px-4 py-3 font-bold">رقم الطلب</th>
                      <th className="whitespace-nowrap px-4 py-3 font-bold">القطع</th>
                      <th className="whitespace-nowrap px-4 py-3 font-bold">المجموع</th>
                      <th className="whitespace-nowrap px-4 py-3 font-bold">الحالة</th>
                      <th className="whitespace-nowrap px-4 py-3 font-bold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((o) => (
                      <tr key={o.id} className="border-b border-line/70 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-muted">
                          {o.items.map((it) => `${it.sizeLabel} — ${it.colorName}`).join("، ")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">{formatMoney(o.totalPrice)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Internal notes */}
        <div className="lg:col-span-1">
          <CustomerNotes customerId={customer.id} />
        </div>
      </div>
    </>
  );
}
